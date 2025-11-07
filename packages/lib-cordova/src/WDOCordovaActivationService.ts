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
 * Service that can activate PowerAuthSDK instance by user weak credentials (like his email, phone number or client ID) + SMS OTP.
 * 
 * When the PowerAuthSDK is activated with this service, `PowerAuthActivationStatus.needVerification` will be `true`
 * and you will need to verify the PowerAuthSDK instance via `WDOVerificationService`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOActivationService extends WDOBaseActivationService {

    protected override api: WDOApi
    readonly powerauth: PowerAuth

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuthSDK instance. This instance needs to be without valid activation.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server.
     */
    constructor(powerauth: PowerAuth, baseUrl: string) {
        super()
        this.api = new WDOApi(powerauth, baseUrl)
        this.powerauth = powerauth
    }

    protected override activatePowerAuth(identityAttributes: any, activationName: string): Promise<WDOPowerAuthActivationResult> {
        const activation = PowerAuthActivation.createWithIdentityAttributes(identityAttributes, activationName)
        return this.powerauth.createActivation(activation)
    }
}