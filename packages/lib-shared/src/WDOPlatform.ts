/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

/* @internal */
export class WDOPlatform {
    static cache: WDOCache
    static networking: WDONetworkingIntegration
    static powerAuth: WDOPowerAuthIntegration
    static utils: WDOPlatformUtils
}

/* @internal */
export interface WDOCache {
    set(key: string, value: string | undefined): Promise<void>
    get(key: string): Promise<string | undefined>
    has(key: string): Promise<boolean>
}

/* @internal */
export interface WDOPlatformUtils {
    crossPlatformName(): "cordova" | "react-native"
    nativePlatformName(): "ios" | "android"
    bundleId(): Promise<string | undefined>
}

/* @internal */
export interface WDONetworkingIntegration {
    // Endpoint creation methods
    signedEndpoint<TRequest, TResponse>(path: string, uriId: string, responseConfig?: WDOResponseConfig, e2eeConfig?: WDOE2EEConfiguration): WDOApiEndpoint<TRequest, TResponse>
    signedWithTokenEndpoint<TRequest, TResponse>(path: string, tokenName: string, responseConfig?: WDOResponseConfig, e2eeConfig?: WDOE2EEConfiguration): WDOApiEndpoint<TRequest, TResponse>
    unsignedEndpoint<TRequest, TResponse>(path: string, responseConfig?: WDOResponseConfig, e2eeConfig?: WDOE2EEConfiguration): WDOApiEndpoint<TRequest, TResponse>

    // Networking creation method
    networking(powerAuth: WDOPowerAuth, baseUrl: string): WDONetworking
}

/* @internal */
export interface WDOPowerAuthIntegration {
    activationWithActivationCode(activationCode: string, activationName: string, otp: string | undefined): WDOPowerAuthActivation
    authenticationWithPassword(password: WDOPowerAuthPassword): WDOPowerAuthAuthentication
    authenticationWithPossession(): WDOPowerAuthAuthentication
    activationWithIdentityAttributes(identityAttributes: any, activationName: string): WDOPowerAuthActivation
    isPowerAuthAuthentication(authentication: any): boolean
}

/* @internal */
export type WDOE2EEConfiguration = 0 | 1 | 2

/* @internal */
export interface WDOResponseConfig { }

/* @internal */
export interface WDOApiEndpoint<TRequest, TResponse> { }

/* @internal */
export interface WDORRequestProcessor { }

/* @internal */
export interface WDONetworking {
    set acceptLanguage(value: string)
    call<TRequest, TResponse>(endpoint: WDOApiEndpoint<TRequest, TResponse>, requestData: TRequest, authentication: WDOPowerAuthAuthentication | undefined, requestProcessor?: WDORRequestProcessor | undefined): Promise<WDOResponse<TResponse>>
}

/* @internal */
export interface WDOResponse<T> {
    status: "OK" | "ERROR"
    responseError?: WDOResponseError
    responseObject?: T
}

/* @internal */
export interface WDOResponseError {
    code: /*WPNKnownRestApiError |*/ string
    message: string
}

// -- PowerAuth related types --

/** Internal multiplatform PowerAuth representation */
export interface WDOPowerAuth {
    fetchActivationStatus(): Promise<WDOPowerAuthActivationStatus>
    validatePassword(password: WDOPowerAuthPassword | string): Promise<void>
    createActivation(activation: WDOPowerAuthActivation): Promise<WDOPowerAuthCreateActivationResult>
    persistActivation(authentication: WDOPowerAuthAuthentication): Promise<void>
    canStartActivation(): Promise<boolean>
    removeActivationLocal(): Promise<void>
    get instanceId(): string
}

/** Internal multiplatform PowerAuthPassword representation */
export interface WDOPowerAuthPassword {
    clear(): Promise<void>
}

/** Internal multiplatform WDOPowerAuthActivation representation */
export interface WDOPowerAuthActivation { }

/** Internal multiplatform WDOPowerAuthAuthentication representation */
export interface WDOPowerAuthAuthentication { }

/** Internal multiplatform WDOPowerAuthCreateActivationResult representation */
export interface WDOPowerAuthCreateActivationResult {
    activationFingerprint: string
    customAttributes?: any
    //userInfo?: PowerAuthUserInfo
}

/** 
 * 
 * The `WDOPowerAuthActivationStatus` object represents complete status of the activation.
 */
export interface WDOPowerAuthActivationStatus {
    /**
     * State of the activation.
     */
    state: "CREATED" | "PENDING_COMMIT" | "ACTIVE" | "BLOCKED" | "REMOVED" | "DEADLOCK"
    /**
     * Number of failed authentication attempts in a row.
     */
    failCount: number
    /**
     * Maximum number of allowed failed authentication attempts in a row.
     */
    maxFailCount: number
    /**
     * Contains `(maxFailCount - failCount)` if state is `ACTIVE`, otherwise 0.
     */
    remainingAttempts: number
    /**
     * Contains custom object returned from the server. The value is optional and PowerAuth Application Server must support this custom object.
     */
    customObject?: any
}