/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseActivationService, WDOPowerAuthActivationResult } from '../../lib-shared/src/WDOActivationService'
import { WDOApi } from './WDOCordovaApi'
import "cordova-powerauth-mobile-sdk"

/**
 * Service that can activate PowerAuth instance by user weak credentials (like his email, phone number or client ID) + optional SMS OTP.
 * 
 * When the PowerAuth is activated with this service, `WDOVerificationService.isVerificationRequired` will be `true`
 * and you will need to verify the PowerAuth instance via `WDOVerificationService`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOActivationService extends WDOBaseActivationService {

    /* @internal */
    protected override api: WDOApi

    /** PowerAuth instance */
    readonly powerauth: PowerAuth

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

    /* @internal */
    protected override activatePowerAuth(identityAttributes: any, activationName: string): Promise<WDOPowerAuthActivationResult> {
        const activation = PowerAuthActivation.createWithIdentityAttributes(identityAttributes, activationName)
        return this.powerauth.createActivation(activation)
    }

    /* @internal */
    protected override activatePowerAuthWithCode(activationCode: string, otp: string | undefined, activationName: string): Promise<WDOPowerAuthActivationResult> {
        const activation = PowerAuthActivation.createWithActivationCode(activationCode, activationName)
        if (otp) {
            activation.additionalActivationOtp = otp
        }
        return this.powerauth.createActivation(activation)
    }

    /* @internal */
    protected override changeAcceptLanguageImpl(language: string): void {
        this.api.networking.acceptLanguage = language
    }
}