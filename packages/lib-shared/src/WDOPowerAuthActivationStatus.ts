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
 * This file contains duck-typed representation of PowerAuthActivationStatus
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
    state: WDOPowerAuthActivationState
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

/**
 * The `WDOPowerAuthActivationState` enum defines all possible states of activation.
 * The state is a part of information received together with the rest
 * of the `WDOPowerAuthActivationStatus` object.
 */
export enum WDOPowerAuthActivationState {
    /**
     * The activation is just created.
     */
    CREATED = "CREATED",
    /**
     * The activation is not completed yet on the server.
     */
    PENDING_COMMIT = "PENDING_COMMIT",
    /**
     * The shared secure context is valid and active.
     */
    ACTIVE = "ACTIVE",
    /**
     * The activation is blocked.
     */
    BLOCKED = "BLOCKED",
    /**
     * The activation doesn't exist anymore.
     */
    REMOVED = "REMOVED",
    /**
     * The activation is technically blocked. You cannot use it anymore
     * for the signature calculations.
     */
    DEADLOCK = "DEADLOCK"
}