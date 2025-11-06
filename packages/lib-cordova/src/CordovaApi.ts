/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseApi } from '../../lib-shared/src/api/Api'
import { WDOEndpoint } from '../../lib-shared/src/api/Endpoints'
import { WDOError } from '../../lib-shared/src/WDOError'
import { WPNE2EEConfiguration, WPNEndpoint, WPNNetworking } from "cordova-powerauth-networking"
import "cordova-powerauth-mobile-sdk"

export class WDOApi extends WDOBaseApi {

    private networking: WPNNetworking
    private powerauth: PowerAuth

    constructor(powerauth: PowerAuth) {
        super()
        this.networking = new WPNNetworking(powerauth)
        this.powerauth = powerauth
    }

    protected override callApi<TRequest, TResponse>(requestObject: TRequest, endpoint: WDOEndpoint): Promise<TResponse> {

        return this.networking.call(
            // construct 
            this.cosntructEndpoint(endpoint),
            { requestObject: requestObject },
            endpoint.e2eeScope === "NONE" ? undefined : PowerAuthAuthentication.possession()
        ).then(result => {
            if (result.responseObject) {
                return result.responseObject as TResponse
            } else if (result.responseError) {
                throw new WDOError(`Server API error: ${result.responseError.code}, ${result.responseError.message}`, result.responseError)
            } else {
                throw new WDOError(`Failed to retrieve activation data`)
            }
        })
    }

    override canStartActivation(): Promise<boolean> {
        return this.powerauth.canStartActivation()
    }
    
    private cosntructEndpoint<TRequest, TResponse>(endpoint: WDOEndpoint): WPNEndpoint<TRequest, TResponse> {
        let scope: WPNE2EEConfiguration
        if (endpoint.e2eeScope === "ACTIVATION") {
            scope = WPNE2EEConfiguration.ACTIVATION_SCOPE
        } else if (endpoint.e2eeScope === "APPLICATION") {
            scope = WPNE2EEConfiguration.APPLICATION_SCOPE
        } else {
            scope = WPNE2EEConfiguration.NOT_ENCRYPTED
        }
        
        if (endpoint.uriId) {
            return WPNEndpoint.signed(endpoint.path, endpoint.uriId, undefined, scope)
        } else if (endpoint.tokenName) {
            return WPNEndpoint.signedWithToken(endpoint.path, endpoint.tokenName, undefined, scope)
        } else {
            return WPNEndpoint.unsigned(endpoint.path)
        }
    }
}