/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOError, WDOErrorReason } from '../../lib-shared/src/WDOError'
import { WDOPowerAuthActivationState, WDOPowerAuthActivationStatus } from '../../lib-shared/src/WDOPowerAuthActivationStatus'
import { WDOBaseVerificationService } from '../../lib-shared/src/WDOVerificationService'
import { WDOVerificationState } from '../../lib-shared/src/WDOVerificationState'
import { WDOApi } from './WDOCordovaApi'
import "cordova-powerauth-mobile-sdk"

/**
 * Service that can verify previously activated PowerAuth instance.
 * 
 * When PowerAuth instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOVerificationService extends WDOBaseVerificationService {

    /* @internal */
    protected override api: WDOApi

    /** PowerAuth instance */
    readonly powerauth: PowerAuth

    /** Checks if verification is required based on PowerAuth activation status */
    public static isVerificationRequired(paStatus: PowerAuthActivationStatus): boolean {
        const flags = paStatus.customObject?.activationFlags as Array<string> | undefined
        return !!flags && flags.some(f => f === "VERIFICATION_PENDING" || f === "VERIFICATION_IN_PROGRESS")
    }

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuth instance. This instance needs to be without valid activation.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    constructor(powerauth: PowerAuth, baseUrl: string) {
        super()
        this.api = new WDOApi(powerauth, baseUrl)
        this.powerauth = powerauth
    }

    /**
     * Finishes verification by creating new PowerAuth activation on given `newPowerAuthInstance`.
     * 
     * The method verifies that the provided `password` is the same as used in the original activation
     * (if `makeSurePasswordIsSameAsOriginal` is set to `true`), then it calls the server API to finish
     * the verification and obtain the activation code for the new activation. Finally, it creates
     * a new activation on `newPowerAuthInstance` using the obtained activation code and persists it
     * with the provided `password`.
     * 
     * After successful completion, the original PowerAuth instance becomes invalid (removed state) and cannot be used anymore.
     * 
     * @param newPowerAuthInstance PowerAuth instance where to create new activation. This instance must not have an existing activation.
     * @param newActivationName Name of the new activation to be created on `newPowerAuthInstance`.
     * @param passwordConfig Configuration for the password to protect the new activation and whether to verify it against the original activation's password.
     * @param userIdentification Optional user identification object to be sent to the server during the finish activation process.
     */
    async finishActivation(
        newPowerAuthInstance: PowerAuth, 
        newActivationName: string, 
        passwordConfig: WDOFinishActivationPassword,
        userIdentification?: any
    ): Promise<WDOVerificationState> {

        try {

            if (passwordConfig.makeSurePasswordIsSameAsOriginal) {

                // password must be reusable
                if ((passwordConfig.password as any).destroyOnUse) { // TODO: ok? maybe make this property public in PowerAuthPassword?
                    throw new WDOError(
                        WDOErrorReason.invalidParameter, 
                        "The provided PowerAuthPassword is configured to be destroyed on use, which is not supported in finishActivation with makeSurePasswordIsSameAsOriginal=true. Please provide a reusable PowerAuthPassword instance. (with destroyOnUse=false)"
                    )
                }

                // validate password against original activation
                await this.powerauth.validatePassword(passwordConfig.password)
            }

            if (await newPowerAuthInstance.canStartActivation() == false) {
                throw new WDOError(WDOErrorReason.powerauthAlreadyActivated, "The provided PowerAuth instance is already activated.")
            }

            return await this.finishActivationInternal(
                userIdentification,
                async (activationCode: string) => {
                    try {
                        const activation = PowerAuthActivation.createWithActivationCode(activationCode, newActivationName)
                        await newPowerAuthInstance.createActivation(activation)
                        await newPowerAuthInstance.persistActivation(PowerAuthAuthentication.persistWithPassword(passwordConfig.password))
                    } catch (e) {
                        // In case of failure, ensure no partial activation remains
                        if (await newPowerAuthInstance.canStartActivation() == false) {
                            await newPowerAuthInstance.removeActivationLocal()
                        }
                        
                        throw e // rethrow
                    }
                }
            )
        } finally {
            await passwordConfig.password.clear() // destroy the password after use
        }
    }

    /* @internal */
    protected override async fetchActivationStatus(): Promise<WDOPowerAuthActivationStatus> {
        const result = await this.powerauth.fetchActivationStatus()
        return {
            state: WDOPowerAuthActivationState[result.state],
            failCount: result.failCount,
            maxFailCount: result.maxFailCount,
            remainingAttempts: result.remainingAttempts,
            customObject: result.customObject
        }
    }

    /* @internal */
    protected override changeAcceptLanguageImpl(language: string): void {
        this.api.networking.acceptLanguage = language
    }

    /* @internal */
    protected override getPAInstanceId(): string {
        return this.powerauth.instanceId
    }
}

/** Configuration for finish activation password */
export class WDOFinishActivationPassword {

    /** PowerAuth password instance */
    readonly password: PowerAuthPassword
    /** Indicates whether to verify that the password matches the original activation's password */
    readonly makeSurePasswordIsSameAsOriginal: boolean

    /**
     * Creates finish activation password configuration
     * 
     * @param password Password to protect the new activation. In case `makeSurePasswordIsSameAsOriginal` is `true`, this password must match the password of the original activation and must be reusable (not destroyed on use).
     * @param makeSurePasswordIsSameAsOriginal If set to `true`, the method verifies that the provided `password` matches the password of the original activation. By default, this is `true`.
     * 
     * @throws WDOError with reason `invalidParameter` if the provided `password` is configured to be destroyed on use, which is not supported when `makeSurePasswordIsSameAsOriginal` is `true`.
     */
    constructor(password: PowerAuthPassword, makeSurePasswordIsSameAsOriginal: boolean = true) {
        this.password = password
        this.makeSurePasswordIsSameAsOriginal = makeSurePasswordIsSameAsOriginal

        if (makeSurePasswordIsSameAsOriginal) {

            // password must be reusable
            if ((password as any).destroyOnUse) { // TODO: ok? maybe make this property public in PowerAuthPassword?
                throw new WDOError(
                    WDOErrorReason.invalidParameter, 
                    "The provided PowerAuthPassword is configured to be destroyed on use, which is not supported in finishActivation with makeSurePasswordIsSameAsOriginal=true. Please provide a reusable PowerAuthPassword instance. (with destroyOnUse=false)"
                )
            }
        }
    }
}