/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDODocumentSide, WDODocumentType } from "../WDODocumentFile"

/** For request that needs to identify the current process. */
export interface ProcessRequest {
    processId: string
}

/** Onboarding process response */
export interface ProcessResponse {
    /** ID of the process */
    processId: string
    /** Status of the process */
    onboardingStatus: WDOOnboardingStatus
    /** 
     * Activation code used during the activation process. 
     * If not present, the activation is created later on in the onboarding process. 
     */
    activationCode?: string
}

/** Status of the onboarding */
export enum WDOOnboardingStatus {
    activationInProgress = "ACTIVATION_IN_PROGRESS",
    verificationInProgress = "VERIFICATION_IN_PROGRESS",
    failed = "FAILED",
    finished = "FINISHED"
}

export interface WDOIdentityStatusResponse {
    processId: string
    identityVerificationStatus: WDOIdentityVerificationStatus
    identityVerificationPhase?: WDOIdentityVerificationPhase
    config: WDOIdentityConfig
}

export interface WDOIdentityConfig {
    otpResendPeriod: string // ISO8601Duration
    otpResendPeriodSeconds: number
}

/** Status of the current identity verification */
export enum WDOIdentityVerificationStatus {
    /** Identity verification is waiting for initialization */
    notInitialized = "NOT_INITIALIZED",
    /** All submitted documents are waiting for verification */
    verificationPending = "VERIFICATION_PENDING",
    /** Identity verification is in progress */
    inProgress = "IN_PROGRESS",
    /** Identity verification was successfully completed */
    accepted = "ACCEPTED",
    /** Identity verification has failed, an error occurred */
    failed = "FAILED",
    /** Identity verification was rejected */
    rejected = "REJECTED"
}

/** Phase of the current identity verification */
export enum WDOIdentityVerificationPhase {
    /** Document upload is in progress */
    documentUpload = "DOCUMENT_UPLOAD",
    /** Presence check is in progress */
    presenceCheck = "PRESENCE_CHECK",
    /** Backend is verifying documents */
    clientEvaluation = "CLIENT_EVALUATION",
    /** Document verification is in progress */
    documentVerification = "DOCUMENT_VERIFICATION",
    /** Cross check on documents is in progress */
    documentVerificationFinal = "DOCUMENT_VERIFICATION_FINAL",
    /** OTP verification needed */
    otp = "OTP_VERIFICATION",
    /** Completed */
    completed = "COMPLETED"
}

/** Types of available documents */ 
export enum WDODocumentSubmitFileType {
    /** National ID card */
    idCard = "ID_CARD",
    /** Passport */
    passport = "PASSPORT",
    /** Driving license */
    driversLicense = "DRIVING_LICENSE",
    /** Selfie photo */
    selfiePhoto = "SELFIE_PHOTO"
}

/** Side of the file */
export enum WDODocumentSubmitFileSide {
    /** Front side of an document. Usually the one with the picture */
    front = "FRONT",
    /** Back side of an document */
    back = "BACK"
}

/// Submitted document metadata
export interface WDODocument {
    /** Name of the file (with path within the submit ZIP file). */
    filename: string
    /** Unique ID of the file */
    id: string
    /** Type of the file */
    type: WDODocumentSubmitFileType
    /** Side of the file */
    side: WDODocumentSubmitFileSide
    /** Status of the processing */
    status: WDODocumentStatus
    /** Possible errors */
    errors?: string[]
}

export enum WDODocumentStatus {
    /** Document was accepted */
    accepted = "ACCEPTED",
    /** Document is being uploaded to the verification system by the backend */
    uploadInProgress = "UPLOAD_IN_PROGRESS",
    /** Document are being processed */
    inProgress = "IN_PROGRESS",
    /** Document is pending verification */
    verificationPending = "VERIFICATION_PENDING",
    /** Document is being verified */
    verificationInProgress = "VERIFICATION_IN_PROGRESS",
    /** Document was rejected */
    rejected = "REJECTED",
    /** Verification of the document failed */
    failed = "FAILED"
}

/// Metadata for file inside ZIP (in `DocumentSubmitRequest.data`).
export interface DocumentSubmitFile {
    /// Name of the file (with path)
    filename: string
    /// Type of the document
    type: DocumentSubmitFileType
    /// Side of the document (for example front side of the ID card)
    side?: DocumentSubmitFileSide
    /// Original document ID in case of re-upload
    originalDocumentId?: string
}

/// Types of available documents
export enum DocumentSubmitFileType {
    /// National ID card
    idCard = "ID_CARD",
    /// Passport
    passport = "PASSPORT",
    // Driving license
    driversLicense = "DRIVING_LICENSE",
    /// Selfie photo
    selfiePhoto = "SELFIE_PHOTO"
}

export function CreateDocumentSubmitFileType(type: WDODocumentType): DocumentSubmitFileType {
    switch (type) {
        case WDODocumentType.idCard:
            return DocumentSubmitFileType.idCard
        case WDODocumentType.passport:
            return DocumentSubmitFileType.passport
        case WDODocumentType.driversLicense:
            return DocumentSubmitFileType.driversLicense
    }
}

/// Side of the file
export enum DocumentSubmitFileSide {
    /// Front side of an document. Usually the one with the picture
    front = "FRONT",
    /// Back side of an document
    back = "BACK"
}

export function CreateDocumentSubmitFileSide(side: WDODocumentSide): DocumentSubmitFileSide {
    switch (side) {
        case WDODocumentSide.front:
            return DocumentSubmitFileSide.front
        case WDODocumentSide.back:
            return DocumentSubmitFileSide.back
    }
}

/// Status of the documents
export interface DocumentStatusResponse {
    /// Overall status
    status: WDODocumentStatus
    /// Status for each document.
    documents: WDODocument[]
}

/// Response of the OTP verify
export interface VerifyOTPResponse {
    /// ID of the process
    processId: string
    /// Current onboarding status
    onboardingStatus: WDOOnboardingStatus
    /// Was OTP verified?
    verified: boolean
    /// Is OTP expired
    expired: boolean
    /// How many attempts are remaining
    remainingAttempts: number
}