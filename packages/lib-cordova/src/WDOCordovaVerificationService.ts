/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOError, WDOErrorReason } from '../../lib-shared/src/WDOError'
import { WDOBaseVerificationService } from '../../lib-shared/src/WDOVerificationService'
import { WDOApi } from './WDOCordovaApi'
import "cordova-powerauth-mobile-sdk"

/**
 * Service that can verify previously activated PowerAuth instance.
 * 
 * When PowerAuth instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOVerificationService extends WDOBaseVerificationService<PowerAuth, PowerAuthPassword, PowerAuthActivation, PowerAuthAuthentication, PowerAuthActivationStatus> {

    /* @internal */
    protected override api: WDOApi

    /** Checks if verification is required based on PowerAuth activation status */
    public static isVerificationRequired(paStatus: PowerAuthActivationStatus): boolean {
        return super.isVerificationRequiredInternal(paStatus)
    }

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuth instance. This instance needs to be without valid activation.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    constructor(powerauth: PowerAuth, baseUrl: string) {
        super(powerauth)
        this.api = new WDOApi(powerauth, baseUrl)
    }

    /* @internal */
    protected override changeAcceptLanguageImpl(language: string): void {
        this.api.networking.acceptLanguage = language
    }

    protected override createPowerAuthActivationWithActivationCode(activationCode: string, activationName: string): PowerAuthActivation {
        return PowerAuthActivation.createWithActivationCode(activationCode, activationName)
    }

    protected override createPowerAuthAuthenticationPassword(password: string | PowerAuthPassword): PowerAuthAuthentication {
        return PowerAuthAuthentication.password(password)
    }
}