/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import "cordova-powerauth-mobile-sdk"
import { WDOApiEndpoint, WDOCache, WDONetworking, WDONetworkingIntegration, WDOPlatformUtils } from '../../lib-shared/src/WDOPlatform'
import { WPNEndpoint, WPNNetworking } from "cordova-powerauth-networking"

/* @internal */
export class WDOCordovaPlatformUtils implements WDOPlatformUtils {

    private cachedEnvInfo: PowerAuthEnvironmentInfo | null = null

    private async getEnvironmentInfo(): Promise<PowerAuthEnvironmentInfo> {
        if (this.cachedEnvInfo === null) {
            this.cachedEnvInfo = await PowerAuthUtils.getEnvironmentInfo()
        }
        return this.cachedEnvInfo
    }

    crossPlatformName(): "cordova" | "react-native" {
        return "cordova"
    }

    async nativePlatformName(): Promise<"ios" | "android"> {
        // lets keep it simple for now
        const systemName = (await this.getEnvironmentInfo()).systemName.toLowerCase()
        if (systemName === "android") {
            return "android"
        } else {
            return "ios"
        }
    }

    async bundleId(): Promise<string | undefined> {
        return (await this.getEnvironmentInfo()).applicationIdentifier
    }
}

/* @internal */
export class WDOCordovaCache implements WDOCache {

    set(key: string, value: string | undefined): Promise<void> {
        if (value) {
            return PowerAuthStorageUtils.setString(key, value, PowerAuthStorageType.SECURE)
        } else {
            return PowerAuthStorageUtils.remove(key, PowerAuthStorageType.SECURE).then(() => { /* no-op */ })
        }
    }

    get(key: string): Promise<string | undefined> {
        return PowerAuthStorageUtils.getString(key, PowerAuthStorageType.SECURE)
    }

    has(key: string): Promise<boolean> {
        return PowerAuthStorageUtils.exists(key, PowerAuthStorageType.SECURE)
    }
}

/* @internal */
export class WDONetworkingCordovaIntegration implements WDONetworkingIntegration {

    signedEndpoint<TRequest, TResponse>(path: string, uriId: string, responseConfig?: any, e2eeConfig?: any): WDOApiEndpoint<TRequest, TResponse> {
        return WPNEndpoint.signed<TRequest, TResponse>(path, uriId, responseConfig, e2eeConfig)
    }

    signedWithTokenEndpoint<TRequest, TResponse>(path: string, tokenName: string, responseConfig?: any, e2eeConfig?: any): WDOApiEndpoint<TRequest, TResponse> {
        return WPNEndpoint.signedWithToken<TRequest, TResponse>(path, tokenName, responseConfig, e2eeConfig)
    }

    unsignedEndpoint<TRequest, TResponse>(path: string, responseConfig?: any, e2eeConfig?: any): WDOApiEndpoint<TRequest, TResponse> {
        return WPNEndpoint.unsigned<TRequest, TResponse>(path, responseConfig, e2eeConfig)
    }

    networking(powerAuth: PowerAuth, baseUrl: string): WDONetworking {
        return new WPNNetworking(powerAuth, baseUrl)
    }
}

/* @internal */
export class WDOPowerAuthCordovaIntegration {

    activationWithActivationCode(activationCode: string, activationName: string, otp: string | undefined): PowerAuthActivation {
        const activation = PowerAuthActivation.createWithActivationCode(activationCode, activationName)
        if (otp) {
            activation.additionalActivationOtp = otp
        }
        return activation
    }

    activationWithIdentityAttributes(identityAttributes: any, activationName: string): PowerAuthActivation {
        return PowerAuthActivation.createWithIdentityAttributes(identityAttributes, activationName)
    }

    authenticationWithPassword(password: PowerAuthPassword): PowerAuthAuthentication {
        return PowerAuthAuthentication.password(password)
    }

    authenticationWithPossession(): PowerAuthAuthentication {
        return PowerAuthAuthentication.possession()
    }

    isPowerAuthAuthentication(authentication: any): boolean {
        return authentication instanceof PowerAuthAuthentication
    }
}