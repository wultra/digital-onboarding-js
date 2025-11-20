/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseApi } from './api/WDOBaseApi'
import { WDOOnboardingStatus } from './api/WDONetworkingObjects'
import { WDOLogger } from './WDOLogger'
import { WDOError } from './WDOError'

export interface WDOPowerAuthActivationResult {
    /**
     * Decimalized fingerprint calculated from device's and server's public keys.
     */
    activationFingerprint: string
    /**
     * When available, contents of this object depends of your enrollment server configuration.
     */
    customAttributes?: any
}

/**
 * Service that can activate PowerAuthSDK instance by user weak credentials (like his email, phone number or client ID) + SMS OTP.
 * 
 *  When the PowerAuthSDK is activated with this service, `PowerAuthActivationStatus.needVerification` will be `true`
 * and you will need to verify the PowerAuthSDK instance via `WDOVerificationService`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export abstract class WDOBaseActivationService {

    protected abstract api: WDOBaseApi
    protected abstract activatePowerAuth(identityAttributes: any, activationName: string): Promise<WDOPowerAuthActivationResult>
    protected abstract activatePowerAuthWithCode(activationCode: string, otp: string | undefined, activationName: string): Promise<WDOPowerAuthActivationResult>

    public get hasActiveProcess(): boolean { return !!this.processData }
        
    // TODO: Cache process ID?
    private processData: { processId: string, activationCode?: string } | undefined

    private get processId(): string | undefined { return this.processData?.processId }

    // PUBLIC API

    /**
     * Retrieves status of the onboarding activation.
     * 
     * @return Promise resolved with onboarding status.
     */
    async status(): Promise<WDOOnboardingStatus> {
        WDOLogger.debug(`Getting activation status for processId=${this.processId}`)
        await this.verifyCanStartProcess()
        const pid = this.verifyHasActiveProcess()
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
        if (this.processId) {
            throw new WDOError("Cannot start the process - processId already obtained, cancel first.")
        }
        await this.verifyCanStartProcess()
        const result = await this.api.activationStart(credentials, processType)
        WDOLogger.info("WDOActivationService.start success")
        WDOLogger.debug(` - processId: ${result.processId}`)
        this.processData = { processId: result.processId, activationCode: result.activationCode }
    }

    /**
     * Cancel the activation process (issues a cancel request to the backend and clears the local process ID).
     * 
     * @param forceCancel When true, the process will be canceled in the SDK even when fails on backend. `true` by default.
     */
    async cancel(forceCancel: boolean = true): Promise<void> {
        WDOLogger.debug(`Canceling activation for processId=${this.processId}, forceCancel=${forceCancel}`)
        const pid = this.verifyHasActiveProcess()
        try {
            await this.api.activationCancel(pid)
            this.processData = undefined
            WDOLogger.info("WDOActivationService.cancel success")
        } catch (error) {
            if (forceCancel) {
                // pretend it was successful and just log the error
                WDOLogger.debug(`Process canceled (but the request failed) - ${error}.`)
                this.processData = undefined
            } else {
                throw error // rethrow
            }
        }
    }

    /** Clear the stored data (without networking call). */
    clear() {
        this.processData = undefined
    }

    /** 
     * OTP resend request. 
     * 
     * This is intended to be displayed for the user to use in case of the OTP is not received.
     * For example, when the user does not receive SMS after some time, there should be a button to "send again".
     */
    async resendOTP(): Promise<void> {
        WDOLogger.debug("Activation: resending OTP")
        const pid = this.verifyHasActiveProcess()
        await this.verifyCanStartProcess()
        await this.api.activationResendOTP(pid)
    }

    /**
     * Demo endpoint available only in Wultra Demo systems.
     * 
     * If the app is running against our demo server, you can retrieve the OTP without needing to send SMS or emails.
     */
    private async getOTP(): Promise<String> {
        WDOLogger.debug("Activation: getting OTP from server (only for testing purposes)")
        const pid = this.verifyHasActiveProcess()
        return (await this.api.activationGetOTP(pid, "ACTIVATION")).otpCode
    }

    async activate(activationName: string, otp?: string): Promise<WDOPowerAuthActivationResult> {
        WDOLogger.debug(`Activating the PowerAuth with activation name '${activationName}'`)
        await this.verifyCanStartProcess()
        const pid = this.verifyHasActiveProcess()
        const code = this.processData?.activationCode
        let result: WDOPowerAuthActivationResult
        if (code) {
            WDOLogger.info("Activating PowerAuth using activation code from the onboarding process")
            result = await this.activatePowerAuthWithCode(code, otp, activationName)
        } else {
            WDOLogger.info("Activating PowerAuth using identity attributes from the onboarding process")
            const identityAttributes = { processId: pid, otpCode: otp, credentialsType: "ONBOARDING" }
            result = await this.activatePowerAuth(identityAttributes, activationName)
        }
        // Clear process ID after activation attempt
        this.processData = undefined
        return result
    }
    // PRIVATE METHODS

    private async verifyCanStartProcess(): Promise<void> {
        if (!(await this.api.canStartActivation())) {
            WDOLogger.error("PowerAuth is already activated - Activation cannot be started/processed.")
            this.processData = undefined
            throw new WDOError("PowerAuth is already activated")
        }
    }

    private verifyHasActiveProcess(): string {
        const pid = this.processId
        if (!pid) {
            WDOLogger.warn("Cannot proceed (processId not available).")
            throw new WDOError("No active activation process")
        }
        return pid
    }
        
}