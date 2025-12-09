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
export interface WDOProcessRequest {
    processId: string
}

/** Onboarding process response */
export interface WDOProcessResponse {
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
    /** Activation part of the process is in progress */
    activationInProgress = "ACTIVATION_IN_PROGRESS",
    /** Verification part of the process is in progress */
    verificationInProgress = "VERIFICATION_IN_PROGRESS",
    /** Onboarding process has failed */
    failed = "FAILED",
    /** Onboarding process is completed */
    finished = "FINISHED"
}

export interface WDOIdentityStatusResponse {
    processId: string
    identityVerificationStatus: WDOIdentityVerificationStatus
    identityVerificationPhase?: WDOIdentityVerificationPhase
    config: WDOIdentityConfig
    consentRequired: boolean
}

/** Configuration for identity verification */
export interface WDOIdentityConfig {
    /** Period after which the OTP can be resent, in seconds */
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

/** Submitted document metadata */
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

/** Status of the document */
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

/** Metadata for file inside ZIP (in `DocumentSubmitRequest.data`). */
export interface WDODocumentSubmitFile {
    /** Name of the file (with path) */
    filename: string
    /** Type of the document */
    type: WDODocumentSubmitFileType
    /** Side of the document (for example front side of the ID card) */
    side: WDODocumentSubmitFileSide
    /** Original document ID in case of re-upload */
    originalDocumentId?: string
    /** Base64 encoded data image. */
    data: Base64URLString
}

/** Converts WDODocumentType to DocumentSubmitFileType */
export function WDOCreateDocumentSubmitFileType(type: WDODocumentType): WDODocumentSubmitFileType {
    switch (type) {
        case WDODocumentType.idCard:
            return WDODocumentSubmitFileType.idCard
        case WDODocumentType.passport:
            return WDODocumentSubmitFileType.passport
        case WDODocumentType.driversLicense:
            return WDODocumentSubmitFileType.driversLicense
    }
}

/** Converts WDODocumentSide to DocumentSubmitFileSide */
export function WDOCreateDocumentSubmitFileSide(side: WDODocumentSide): WDODocumentSubmitFileSide {
    switch (side) {
        case WDODocumentSide.front:
            return WDODocumentSubmitFileSide.front
        case WDODocumentSide.back:
            return WDODocumentSubmitFileSide.back
    }
}

/** Status of the documents */
export interface WDODocumentStatusResponse {
    /** Overall status */
    status: WDODocumentStatus
    /** Status for each document. */
    documents: WDODocument[]
}

/** Response of the OTP verify */
export interface WDOVerifyOTPResponse {
    /** ID of the process */
    processId: string
    /** Current onboarding status */
    onboardingStatus: WDOOnboardingStatus
    /** Was OTP verified? */
    verified: boolean
    /** Is OTP expired */
    expired: boolean
    /** How many attempts are remaining */
    remainingAttempts: number
}

/** Configuration for a document */
export interface WDOConfigurationDocument {
    /** Type of the document */
    type: string,
    /** Is the document mandatory */
    mandatory: boolean,
    /** Number of sides the document has */
    sideCount: number
}

/** Configuration for the onboarding process */
export interface WDOConfigurationResponse {
    /** Is the onboarding process enabled */
    enabled: boolean,
    /** Is OTP required for the first part - identification/activation. */
    otpForIdentification: boolean,
    /** Is OTP required for the second part - identity verification. */
    otpForIdentityVerification: boolean,
    /** Documents required for identity verification. */
    documents: {
        /** Number of required documents */
        requiredDocumentsCount: number,
        /** List of documents */
        items: Array<WDOConfigurationDocument>
    }
}