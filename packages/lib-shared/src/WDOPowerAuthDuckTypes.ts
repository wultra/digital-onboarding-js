/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ######################################
 * This file contains duck-typed representation of PowerAuth types
 * to avoid direct dependency on PowerAuth types in the shared library.
 * ######################################
 */

/**
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

// - INTERNALS

/* @internal */
export interface WDOPowerAuth {
    fetchActivationStatus(): Promise<WDOPowerAuthActivationStatus>
    validatePassword(password: WDOPowerAuthPassword | string): Promise<void>
    createActivation(activation: WDOPowerAuthActivation): Promise<WDOPowerAuthCreateActivationResult>
    persistActivation(authentication: WDOPowerAuthAuthentication): Promise<void>
    canStartActivation(): Promise<boolean>
    removeActivationLocal(): Promise<void>
    get instanceId(): string
}

/* @internal */
export interface WDOPowerAuthPassword {
    clear(): Promise<void>
}

/* @internal */
export interface WDOPowerAuthActivation {

}

/* @internal */
export interface WDOPowerAuthAuthentication {

}

/* @internal */
export interface WDOPowerAuthCreateActivationResult {
    activationFingerprint: string;
    customAttributes?: any;
    //userInfo?: PowerAuthUserInfo;
}