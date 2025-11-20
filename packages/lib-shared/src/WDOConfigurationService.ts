/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseApi } from './api/WDOBaseApi'
import { WDOConfigurationResponse } from './api/WDONetworkingObjects'

export abstract class WDOBaseConfigurationService {

    protected abstract api: WDOBaseApi

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