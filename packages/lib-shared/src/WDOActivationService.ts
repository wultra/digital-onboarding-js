/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOOnboardingStatus } from './api/WDONetworkingObjects'
import { WDOLogger } from './WDOLogger'
import { WDOError, WDOErrorReason } from './WDOError'
import { WDOPlatform, WDOPowerAuth, WDOPowerAuthCreateActivationResult } from './WDOPlatform'
import { WDOApi } from './api/WDOApi'

/* @internal */
interface WDOActivationProcessData {
    processId: string
    activationCode?: string
}

/**
 * Service that can activate PowerAuth instance by user weak credentials (like his email, phone number or client ID) + optional SMS OTP.
 * 
 * When the PowerAuth is activated with this service, `WDOVerificationService.isVerificationRequired` will be `true`
 * and you will need to verify the PowerAuth instance via `WDOVerificationService`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export abstract class WDOBaseActivationService<TPowerAuth extends WDOPowerAuth> {

    /** PowerAuth instance */
    public readonly powerauth: TPowerAuth

    /* @internal  */
    private readonly api: WDOApi<TPowerAuth>
    
    /* @internal  */
    private get cacheKey(): string { return `wdopd_${this.powerauth.instanceId}` }
    
    /* @internal  */
    private async setCachedProcessData(data: WDOActivationProcessData | undefined): Promise<void> {
        await WDOPlatform.cache.set(this.cacheKey, JSON.stringify(data))
    }

    /* @internal  */
    private async getCachedProcessData(): Promise<WDOActivationProcessData | undefined> {
        const data = await WDOPlatform.cache.get(this.cacheKey)
        if (!data) {
            return undefined
        }
        return JSON.parse(data) as WDOActivationProcessData
    }

    /* @internal  */
    private async processId(): Promise<string | undefined> { return (await this.getCachedProcessData())?.processId }

    // PUBLIC API

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuth instance. This instance needs to be without valid activation.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    public constructor(powerauth: TPowerAuth, baseUrl: string) {
        this.api = new WDOApi<TPowerAuth>(powerauth, baseUrl)
        this.powerauth = powerauth
    }

    /** 
     * If the activation process is in progress. 
     * 
     * Note that even if this property is `true` it can be already discontinued on the server.
     * Calling `status()` for example after the app is launched in this case is recommended.
     */
    public async hasActiveProcess(): Promise<boolean> { return !!(await this.getCachedProcessData()) }

    /** 
     * Accept language for the outgoing requests headers.
     * Default value is "en".
     *
     * Standard RFC "Accept-Language" https://tools.ietf.org/html/rfc7231#section-5.3.5
     * Response texts are based on this setting. For example when "de" is set, server
     * will return error texts and other in german (if available).
     */
    public changeAcceptLanguage(language: string) {
        this.api.networking.acceptLanguage = language
    }

    /**
     * Retrieves status of the onboarding activation.
     * 
     * @return Promise resolved with onboarding status.
     */
    async status(): Promise<WDOOnboardingStatus> {
        WDOLogger.debug(`Getting activation status for processId=${await this.processId()}`)
        await this.verifyCanStartActivation()
        const pid = await this.verifyHasActiveProcess()
        const result = await this.api.activationGetStatus(pid)
        return result.onboardingStatus
    }

    /**
     * Start onboarding activation with user credentials.
     * 
     * For example, when you require email and birth date, your object would look like this:
     * ```
     * {
     *   email: "<user_email>",
     *   birthdate: "<user_birth_date>"
     * }
     * ```
     * @param credentials Object with credentials. Which credentials are needed should be provided by a system/backend provider.
     * @param processType The process type identification. If not specified, the default process type will be used.
     */
    async start(credentials: any, processType?: string): Promise<void> {
        WDOLogger.debug(`Starting activation with credentials: ${JSON.stringify(credentials)}`)
        if (await this.processId()) {
            throw new WDOError(WDOErrorReason.processAlreadyInProgress, "Cannot start the process - processId already obtained, cancel first.")
        }
        await this.verifyCanStartActivation()
        const result = await this.api.activationStart(credentials, processType)
        WDOLogger.info("WDOActivationService.start success")
        WDOLogger.debug(` - processId: ${result.processId}`)
        await this.setCachedProcessData({ processId: result.processId, activationCode: result.activationCode })
    }

    /**
     * Cancel the activation process (issues a cancel request to the backend and clears the local process ID).
     * 
     * @param forceCancel When true, the process will be canceled in the SDK even when fails on backend. `true` by default.
     */
    async cancel(forceCancel: boolean = true): Promise<void> {
        WDOLogger.debug(`Canceling activation for processId=${await this.processId()}, forceCancel=${forceCancel}`)
        const pid = await this.verifyHasActiveProcess()
        try {
            await this.api.activationCancel(pid)
            await this.setCachedProcessData(undefined)
            WDOLogger.info("WDOActivationService.cancel success")
        } catch (error) {
            if (forceCancel) {
                // pretend it was successful and just log the error
                WDOLogger.debug(`Process canceled (but the request failed) - ${error}.`)
                await this.setCachedProcessData(undefined)
            } else {
                throw error // rethrow
            }
        }
    }

    /** Clear the stored data (without networking call). */
    async clear(): Promise<void> {
        await this.setCachedProcessData(undefined)
    }

    /** 
     * OTP resend request. 
     * 
     * This is intended to be displayed for the user to use in case of the OTP is not received.
     * For example, when the user does not receive SMS after some time, there should be a button to "send again".
     */
    async resendOTP(): Promise<void> {
        WDOLogger.debug("Activation: resending OTP")
        const pid = await this.verifyHasActiveProcess()
        await this.verifyCanStartActivation()
        await this.api.activationResendOTP(pid)
    }

    /**
     * @internal
     * Demo endpoint available only in Wultra Demo systems.
     * 
     * If the app is running against our demo server, you can retrieve the OTP without needing to send SMS or emails.
     */
    private async getOTP(): Promise<String> {
        WDOLogger.debug("Activation: getting OTP from server (only for testing purposes)")
        const pid = await this.verifyHasActiveProcess()
        return (await this.api.activationGetOTP(pid, "ACTIVATION")).otpCode
    }

    /**
     * Activate the PowerAuth instance that was passed in the initializer.
     * 
     * @param activationName Name of the activation. Usually something like John's iPhone or similar.
     * @param otp OTP code received by the user (via SMS or email). Optional when not required.
     * @return Promise resolved with activation result.
     */ 
    async activate(activationName: string, otp?: string): Promise<WDOPowerAuthCreateActivationResult> {
        WDOLogger.debug(`Activating the PowerAuth with activation name '${activationName}'`)
        await this.verifyCanStartActivation()
        const pid = await this.verifyHasActiveProcess()
        const code = (await this.getCachedProcessData())?.activationCode
        let result: WDOPowerAuthCreateActivationResult
        try {
            if (code) {
                WDOLogger.info("Activating PowerAuth using activation code from the onboarding process")
                const activation = WDOPlatform.powerAuthFactory.createPowerAuthActivationWithActivationCode(code, activationName, otp)
                result = await this.powerauth.createActivation(activation)
            } else {
                WDOLogger.info("Activating PowerAuth using identity attributes from the onboarding process")
                const identityAttributes = { processId: pid, otpCode: otp, credentialsType: "ONBOARDING" }
                const activation = WDOPlatform.powerAuthFactory.createPowerAuthActivationWithIdentityAttributes(identityAttributes, activationName)
                result = await this.powerauth.createActivation(activation)
            }
        } catch (error) {
            throw new WDOError(WDOErrorReason.activationFailed, "Activation failed", error)
        }
        // Clear process ID after activation attempt
        await this.setCachedProcessData(undefined)
        return result
    }

    // PRIVATE METHODS

    /* @internal */
    private async verifyCanStartActivation(): Promise<void> {
        if (!(await this.powerauth.canStartActivation())) {
            WDOLogger.error("PowerAuth is already activated - Activation cannot be started/processed.")
            await this.setCachedProcessData(undefined)
            throw new WDOError(WDOErrorReason.powerauthAlreadyActivated, "PowerAuth is already activated")
        }
    }

    /* @internal */
    private async verifyHasActiveProcess(): Promise<string> {
        const pid = await this.processId()
        if (!pid) {
            WDOLogger.warn("Cannot proceed (processId not available).")
            throw new WDOError(WDOErrorReason.processNotInProgress, "No active activation process")
        }
        return pid
    }
}