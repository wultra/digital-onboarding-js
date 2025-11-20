/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseConfigurationService } from '../../lib-shared/src/WDOConfigurationService'
import { WDOApi } from './WDOCordovaApi'
import "cordova-powerauth-mobile-sdk"

/** Service that provides configuration-related operations for the Wultra Digital Onboarding SDK. */
export class WDOConfigurationService extends WDOBaseConfigurationService {

    protected override api: WDOApi

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuthSDK instance.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server.
     */
    constructor(powerauth: PowerAuth, baseUrl: string) {
        super()
        this.api = new WDOApi(powerauth, baseUrl)
    }
}