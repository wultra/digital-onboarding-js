/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseActivationService, WDOPowerAuthActivationResult } from '../../lib-shared/src/WDOActivationService'
import { WDOApi } from './CordovaApi'
import "cordova-powerauth-mobile-sdk"

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