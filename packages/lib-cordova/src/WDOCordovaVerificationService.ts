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

    async finishActivation(password: PowerAuthPassword, newPowerAuthInstance: PowerAuth, newActivationName: string, userIdentification?: any): Promise<WDOVerificationState> {

        if ((password as any).destroyOnUse) { // TODO: ok? maybe make this property public in PowerAuthPassword?
            throw new WDOError(WDOErrorReason.invalidParameter, "The provided PowerAuthPassword is configured to be destroyed on use, which is not supported in finishActivation.")
        }

        if (await newPowerAuthInstance.canStartActivation() == false) {
            throw new WDOError(WDOErrorReason.powerauthAlreadyActivated, "The provided PowerAuth instance is already activated.")
        }

        return await this.finishActivationInternal(
            PowerAuthAuthentication.password(password),
            userIdentification,
            async (activationCode: string) => {
                try {
                    const activation = PowerAuthActivation.createWithActivationCode(activationCode, newActivationName)
                    await newPowerAuthInstance.createActivation(activation)
                    await newPowerAuthInstance.persistActivation(PowerAuthAuthentication.persistWithPassword(password))
                } catch (e) {
                    // In case of failure, ensure no partial activation remains
                    if (await newPowerAuthInstance.canStartActivation() == false) {
                        await newPowerAuthInstance.removeActivationLocal()
                    }
                    
                    throw e // rethrow
                } finally {
                    await password.clear() // destroy the password after use
                }
            }
        )
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