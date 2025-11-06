/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

/** For request that needs to identify the current process. */
export interface ProcessRequest {
    processId: string
}

/** Onboarding process response */
export interface ProcessResponse {
    /// ID of the process
    processId: string
    /// Status of the process
    onboardingStatus: WDOOnboardingStatus
}

/** Status of the onboarding */
export enum WDOOnboardingStatus {
    activationInProgress = "ACTIVATION_IN_PROGRESS",
    verificationInProgress = "VERIFICATION_IN_PROGRESS",
    failed = "FAILED",
    finished = "FINISHED"
}