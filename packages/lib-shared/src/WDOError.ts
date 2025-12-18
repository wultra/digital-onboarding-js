/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOLogger } from "./WDOLogger"

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

    /** 
     * Whether retrying OTP is allowed based on remaining attempts.
     * 
     * This may be filled only when the error reason is `WDOErrorReason.activationFailed`.
     */
    get allowOnboardingOtpRetry(): boolean { return this.onboardingOtpRemainingAttempts !== undefined && this.onboardingOtpRemainingAttempts > 0 }

    /**
     * Number of remaining OTP attempts during onboarding
     * 
     * This may be filled only when the error reason is `WDOErrorReason.activationFailed`.
     */
    get onboardingOtpRemainingAttempts(): number | undefined {
        if (this.additionalInfo?.originalException?.userInfo?.responseBody) {
            try {
                const parsedResponse = JSON.parse(this.additionalInfo.originalException.userInfo.responseBody)
                return parsedResponse.remainingAttempts ?? undefined
            } catch {
                WDOLogger.error("WDOError.onboardingOtpRemainingAttempts: failed to parse response body")
                return undefined
            }
        } else {
            return undefined
        }
    }
}

/** Reasons for WDO errors */
export enum WDOErrorReason {
    /** Network error occurred */
    networkError = "NETWORK_ERROR",

    /** Activation failed */
    activationFailed = "ACTIVATION_FAILED",

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