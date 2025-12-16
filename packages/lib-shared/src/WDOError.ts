/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

/** Represent error thrown from a WDO library */
export class WDOError {

    /** Reason for the error */
    readonly reason: WDOErrorReason

    /** Error message */
    readonly message: string

    /** Additional info about the error (eg. original error object) */
    readonly additionalInfo?: any

    /** Helper to identify this object as a WDOError */
    readonly isWdoError = true

    /* @internal */
    constructor(reason: WDOErrorReason, message: string, additionalInfo?: any) {
        this.reason = reason
        this.message = message
        this.additionalInfo = additionalInfo
    }
}

/** Reasons for WDO errors */
export enum WDOErrorReason {
    /** Network error occurred */
    networkError = "NETWORK_ERROR",

    /** Process is already in progress - happens when start() is called twice */
    processAlreadyInProgress = "PROCESS_ALREADY_IN_PROGRESS",

    /** No process is in progress - happens when an operation requires an active process */
    processNotInProgress = "PROCESS_NOT_IN_PROGRESS",

    /** The PowerAuth instance is already activated when trying to activate it again */
    powerauthAlreadyActivated = "POWERAUTH_ALREADY_ACTIVATED",

    /** The PowerAuth instance is not activated when trying to use it */
    powerauthNotActivated = "POWERAUTH_NOT_ACTIVATED",

    /** OTP verification failed */
    otpFailed = "OTP_FAILED"
    
}