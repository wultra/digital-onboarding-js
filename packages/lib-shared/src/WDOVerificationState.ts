/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOVerificationScanProcess } from "./WDOVerificationScanProcess"

/** 
 * State which should be presented to the user. 
 * Each state represents a separate screen UI that should be presented to the user. 
 * 
 * This type is an "tagged union" type, where each interface has a `type` property
 * that uniquely identifies the state type.
 * 
 * Usage:
 * 
 * ```
 * const state = await verificationService.status()
 * if (state.type === WDOVerificationStateType.scanDocument ) {
 *   // We are in the scan document state, access specific properties
 *   const process = state.process
 * }
 * ```
 */
export type WDOVerificationState =
    | WDOIntroState
    | WDODocumentsToScanSelectState
    | WDOScanDocumentState
    | WDOProcessingState
    | WDOPresenceCheckState
    | WDOOtpState
    | WDOFinishActivation
    | WDOFailedState
    | WDOEndStateState
    | WDOSuccessState

/** 
 * Show the verification introduction screen where the user can start the activation. 
 * 
 * The next step should be calling the `start`.
 */
export interface WDOIntroState {
    type: WDOVerificationStateType.intro,
    /** Indicates whether the user consent is required to proceed */
    consentRequired: boolean
}

/**
 * Show document selection to the user. Which documents are available and how many
 * can the user select is up to your backend configuration.
 * 
 * The next step should be calling the `documentsSetSelectedTypes`.
 */
export interface WDODocumentsToScanSelectState {
    type: WDOVerificationStateType.documentsToScanSelect
}

/**
 * User should scan documents - display UI for the user to scan all necessary documents.
 * 
 * The next step should be calling the `documentsSubmit`.
 */
export interface WDOScanDocumentState {
    type: WDOVerificationStateType.scanDocument
    /** Scanning process that helps with the document scanning */
    process: WDOVerificationScanProcess
}

/** 
 * The system is processing data - show loading with text hint from provided `WDOStatusCheckReason`.
 * 
 * The next step should be calling the `status`.
 */
export interface WDOProcessingState {
    type: WDOVerificationStateType.processing
    /** Reason for the current processing state */
    item: WDOStatusCheckReason
}

/** 
 * The user should be presented with a presence check.
 * Presence check is handled by third-party SDK based on the project setup.
 * 
 * The next step should be calling the `presenceCheckInit` to start the check and `presenceCheckSubmit` to
 * mark it finished.  Note that these methods won't change the status and it's up to the app to handle the process of the presence check.
 */
export interface WDOPresenceCheckState {
    type: WDOVerificationStateType.presenceCheck
}

/**
 * Show enter OTP screen with resend button.
 * 
 * The next step should be calling the `verifyOTP` with user-entered OTP.
 * The OTP is usually SMS or email.
 */
export interface WDOOtpState {
    type: WDOVerificationStateType.otp
    /** Number of remaining attempts to enter the correct OTP. Available after a failed OTP attempt */
    remainingAttempts?: number
}

/**
 * Show "finish activation" with PIN prompt screen.
 * 
 * The next step should be calling the `finishActivation` with user entered PIN.
 */
export interface WDOFinishActivation {
    type: WDOVerificationStateType.finishActivation
}

/**
 * Verification failed and can be restarted
 * 
 * The next step should be calling the `restartVerification` or `cancelWholeProcess` based on
 * the user's decision if he wants to try it again or cancel the process.
 */
export interface WDOFailedState {
    type: WDOVerificationStateType.failed
}

/**
 * Verification is canceled and the user needs to start again with a new PowerAuth activation.
 * 
 * The next step should be calling the `PowerAuth.removeActivationLocal()` and starting activation from scratch.
 */
export interface WDOEndStateState {
    type: WDOVerificationStateType.endState
    /** Reason for the end state */
    reason: WDOEndStateReason
    /** In case the reason is `rejected`, this field contains the reject reason if it was provided by the system. */
    rejectReason?: string
}

/**
 * Verification was successfully ended. Continue into your app flow.
 */
export interface WDOSuccessState {
    type: WDOVerificationStateType.success
}

/** Types of the verification state */
export enum WDOVerificationStateType {
    /** 
     * Show the verification introduction screen where the user can start the activation. 
     * 
     * The next step should be calling the `start()`.
     */
    intro = "intro",
    /**
     * Show document selection to the user. Which documents are available and how many
     * can the user select is up to your backend configuration.
     * 
     * The next step should be calling the `documentsSetSelectedTypes`.
     */
    documentsToScanSelect = "documentsToScanSelect",
    /**
     * User should scan documents - display UI for the user to scan all necessary documents.
     * 
     * The next step should be calling the `documentsSubmit`.
     */
    scanDocument = "scanDocument",
    /** 
     * The system is processing data - show loading with text hint from provided `WDOStatusCheckReason`.
     * 
     * The next step should be calling the `status`.
     */
    processing = "processing",
    /** 
     * The user should be presented with a presence check.
     * Presence check is handled by third-party SDK based on the project setup.
     * 
     * The next step should be calling the `presenceCheckInit` to start the check and `presenceCheckSubmit` to
     * mark it finished.  Note that these methods won't change the status and it's up to the app to handle the process of the presence check.
     */
    presenceCheck = "presenceCheck",
    /**
     * Show enter OTP screen with resend button.
     * 
     * The next step should be calling the `verifyOTP` with user-entered OTP.
     * The OTP is usually SMS or email.
     */
    otp = "otp",
    /**
     * Show "finish activation" with PIN prompt screen.
     * 
     * The next step should be calling the `finishActivation` with user entered PIN.
     */
    finishActivation = "finishActivation",
    /**
     * Verification failed and can be restarted
     * 
     * The next step should be calling the `restartVerification` or `cancelWholeProcess` based on
     * the user's decision if he wants to try it again or cancel the process.
     */
    failed = "failed",
    /**
     * Verification is canceled and the user needs to start again with a new PowerAuth activation.
     * 
     * The next step should be calling the `PowerAuth.removeActivationLocal()` and starting activation from scratch.
     */
    endState = "endState",
    /**
     * Verification was successfully ended. Continue into your app flow.
     */
    success = "success"
}

/** The reason why the process ended in a non-recoverable state. */
export enum WDOEndStateReason {
    /**
     * The verification was rejected by the system
     * 
     * eg: Fake information, fraud detection, or user is trying repeatedly in a short time.
     * The real reason is not presented to the user and is only audited on the server.
     */
    rejected = "rejected",

    /**
     * The limit of repeat tries was reached. There is a fixed number of tries that the user can reach
     * before the system stops the process.
     */
    limitReached = "limitReached",

    /** An unknown reason. */
    other = "other"
}

/**
 * The reason for what we are waiting for. For example, we can wait for documents to be OCRed and matched against the database.
 * Use these values for better loading texts to tell the user what is happening - some tasks may take some time 
 * and it would be frustrating to just show a generic loading indicator.
 */
export enum WDOStatusCheckReason {
    /** Unknown reason */
    unknown = "unknown",
    /** Waiting for document to be uploaded to the OCR service */
    documentUpload = "documentUpload",
    /** Waiting for document to be verified */
    documentVerification = "documentVerification",
    /** Document was accepted, waiting to be cross-verified */
    documentAccepted = "documentAccepted",
    /** Cross verification of documents is in progress */
    documentsCrossVerification = "documentsCrossVerification",
    /** Client is being verified */
    clientVerification = "clientVerification",
    /** Client was accepted */
    clientAccepted = "clientAccepted",
    /** Verifying user presence */
    verifyingPresence = "verifyingPresence",
    /** 
     * Waiting for the institution to approve the onboarding of the user.
     * 
     * This may take some time, depending on the institution's processes.
     */
    onboardingApproval = "onboardingApproval"
}

/** Additional data that comes with the state from the server. */
export interface WDOVerificationStateServerData {
    /** Data specific to the verification process */
    serverData: WDOProcessServerData
}

/** Data specific to the verification process */
export interface WDOProcessServerData {
    /** Unique identifier for the verification process */
    processId: string
    /** Type of the verification process */
    processType: string
}
