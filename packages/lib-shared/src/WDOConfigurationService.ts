/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOApi } from './api/WDOApi'
import { WDOConfigurationResponse } from './api/WDONetworkingObjects'
import { WDOPowerAuth } from './WDOPlatform'

/** Service that provides configuration for the Wultra Digital Onboarding SDK. */
export abstract class WDOBaseConfigurationService<TPowerAuth extends WDOPowerAuth> {

    /* @internal */
    private api: WDOApi<TPowerAuth>

    /** PowerAuth instance */
    public readonly powerauth: TPowerAuth

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuth instance.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    constructor(powerauth: TPowerAuth, baseUrl: string) {
        this.api = new WDOApi(powerauth, baseUrl)
        this.powerauth = powerauth
    }

    /**
     * Fetches configuration for the given process type from the server.
     * 
     * @param processType Type of the process for which to fetch configuration.
     * @returns Configuration response from the server.
     */
    async getConfiguration(processType: string): Promise<WDOConfigurationResponse> {
        return await this.api.getConfiguration(processType)
    }
}