/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOVerificationScanProcess } from "./WDOVerificationScanProcess"
import { WDOStatusCheckReason } from "./WDOVerificationService"

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
 * const state = await verificationService.status();
 * if (state.type === WDOVerificationStateType.scanDocument ) {
 *   // We are in the scan document state, access specific properties
 *   const process = state.process;
 * }
 * ```
 */
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

/** 
 * Show the verification introduction screen where the user can start the activation. 
 * 
 * The next step should be calling the `consentGet()`.
 */
interface Intro {
    type: WDOVerificationStateType.intro
}

/**
 * Show approve/cancel user consent.
 * 
 * The content of the text depends on the server configuration and might be plain text or HTML.
 * 
 * The next step should be calling the `consentApprove`.
 */
interface Consent {
    type: WDOVerificationStateType.consent
    /** Content of the consent text, which may be plain text or HTML depending on server configuration */
    body: string
}

/**
 * Show document selection to the user. Which documents are available and how many
 * can the user select is up to your backend configuration.
 * 
 * The next step should be calling the `documentsSetSelectedTypes`.
 */
interface DocumentsToScanSelect {
    type: WDOVerificationStateType.documentsToScanSelect
}

/**
 * User should scan documents - display UI for the user to scan all necessary documents.
 * 
 * The next step should be calling the `documentsSubmit`.
 */
interface ScanDocument {
    type: WDOVerificationStateType.scanDocument
    /** Scanning process that helps with the document scanning */
    process: WDOVerificationScanProcess
}

/** 
 * The system is processing data - show loading with text hint from provided `WDOStatusCheckReason`.
 * 
 * The next step should be calling the `status`.
 */
interface Processing {
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
interface PresenceCheck {
    type: WDOVerificationStateType.presenceCheck
}

/**
 * Show enter OTP screen with resend button.
 * 
 * The next step should be calling the `verifyOTP` with user-entered OTP.
 * The OTP is usually SMS or email.
 */
interface Otp {
    type: WDOVerificationStateType.otp
    /** Number of remaining attempts to enter the correct OTP */
    remainingAttempts?: number
}

/**
 * Verification failed and can be restarted
 * 
 * The next step should be calling the `restartVerification` or `cancelWholeProcess` based on
 * the user's decision if he wants to try it again or cancel the process.
 */
interface Failed {
    type: WDOVerificationStateType.failed
}

/**
 * Verification is canceled and the user needs to start again with a new PowerAuth activation.
 * 
 * The next step should be calling the `PowerAuth.removeActivationLocal()` and starting activation from scratch.
 */
interface EndState {
    type: WDOVerificationStateType.endState
    /** Reason for the end state */
    reason: WDOEndStateReason
}

/**
 * Verification was successfully ended. Continue into your app flow.
 */
interface Success {
    type: WDOVerificationStateType.success
}

/** Types of the verification state */
export enum WDOVerificationStateType {
    /** 
     * Show the verification introduction screen where the user can start the activation. 
     * 
     * The next step should be calling the `consentGet()`.
     */
    intro = "intro",
    /**
     * Show approve/cancel user consent.
     * 
     * The content of the text depends on the server configuration and might be plain text or HTML.
     * 
     * The next step should be calling the `consentApprove`.
     */
    consent = "consent",
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