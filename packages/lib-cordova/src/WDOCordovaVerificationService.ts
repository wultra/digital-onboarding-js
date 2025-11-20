/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseVerificationService } from '../../lib-shared/src/WDOVerificationService'
import { WDOApi } from './WDOCordovaApi'
import "cordova-powerauth-mobile-sdk"

/**
 * Service that can verify previously activated PowerAuthSDK instance.
 * 
 * When PowerAuthSDK instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOVerificationService extends WDOBaseVerificationService {

    protected override api: WDOApi
    readonly powerauth: PowerAuth

    public static isVerificationRequired(paStatus: PowerAuthActivationStatus): boolean {
        const flags = paStatus.customObject?.activationFlags as Array<string> | undefined
        return !!flags && flags.some(f => f === "VERIFICATION_PENDING" || f === "VERIFICATION_IN_PROGRESS")
    }

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
}