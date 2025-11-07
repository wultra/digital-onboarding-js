/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOStatusCheckReason } from "./WDOVerificationService"

export type WDOVerificationState =
    | Intro
    | Consent
    | DocumentsToScanSelect
    | ScanDocument
    | Processing
    | PresenceCheck
    | Otp
    | Failed
    | EndState
    | Success

interface Intro {
    type: WDOVerificationStateType.intro
}

interface Consent {
    type: WDOVerificationStateType.consent
    body: string
}

interface DocumentsToScanSelect {
    type: WDOVerificationStateType.documentsToScanSelect
}

interface ScanDocument {
    type: WDOVerificationStateType.scanDocument
    process: any // TODO: WDOVerificationScanProcess
}

interface Processing {
    type: WDOVerificationStateType.processing
    item: WDOStatusCheckReason
}

interface PresenceCheck {
    type: WDOVerificationStateType.presenceCheck
}

interface Otp {
    type: WDOVerificationStateType.otp
    remainingAttempts?: number
}

interface Failed {
    type: WDOVerificationStateType.failed
}

interface EndState {
    type: WDOVerificationStateType.endState
    reason: WDOEndStateReason
}

interface Success {
    type: WDOVerificationStateType.success
}

export enum WDOVerificationStateType {
    intro = "intro",
    consent = "consent",
    documentsToScanSelect = "documentsToScanSelect",
    scanDocument = "scanDocument",
    processing = "processing",
    presenceCheck = "presenceCheck",
    otp = "otp",
    failed = "failed",
    endState = "endState",
    success = "success"
}

// TODO: delete?
export enum WDOProcessingItem {
    unknown = "unknown",
    documentUpload = "documentUpload",
    documentVerification = "documentVerification",
    documentAccepted = "documentAccepted",
    documentsCrossVerification = "documentsCrossVerification",
    verifyingPresence = "verifyingPresence",
    clientVerification = "clientVerification",
    clientAccepted = "clientAccepted"
}

//export function processingItemFromVerificationStatus(reason: )

export enum WDOEndStateReason {
    rejected = "rejected",
    limitReached = "limitReached",
    other = "other"
}