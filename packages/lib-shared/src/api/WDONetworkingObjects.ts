/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

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
    /** The onboarding process has failed */
    failed = "FAILED",
    /** Onboarding process is completed */
    finished = "FINISHED"
}

/* @internal */
export interface WDOIdentityStatusResponse {
    processId: string
    identityVerificationStatus: WDOIdentityVerificationStatus
    identityVerificationPhase?: WDOIdentityVerificationPhase
    config: WDOIdentityConfig
    consentRequired: boolean
}

/* @internal */
export interface WDOIdentityConfig {
    /** Period after which the OTP can be resent, in seconds */
    otpResendPeriodSeconds: number
}

/* @internal */
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

/* @internal */
export enum WDOIdentityVerificationPhase {
    /** Document upload is in progress */
    documentUpload = "DOCUMENT_UPLOAD",
    /** Presence check is in progress */
    presenceCheck = "PRESENCE_CHECK",
    /** Backend is verifying documents */
    clientEvaluation = "CLIENT_EVALUATION",
    /** Document verification is in progress */
    documentVerification = "DOCUMENT_VERIFICATION",
    /** Cross-check on documents is in progress */
    documentVerificationFinal = "DOCUMENT_VERIFICATION_FINAL",
    /** OTP verification needed */
    otp = "OTP_VERIFICATION",
    /** Waiting for onboarding approval */
    onboardingApproval = "ONBOARDING_APPROVAL",
    /** Exchanging the temporary activation for the permanent one. */
    activationFinish = "ACTIVATION_FINISH",
    /** Completed */
    completed = "COMPLETED"
}

/* @internal */
export enum WDODocumentSubmitFileSide {
    /** Front side of a document. Usually the one with the picture */
    front = "FRONT",
    /** Back side of a document */
    back = "BACK"
}

/* @internal */
export interface WDODocument {
    /** Name of the file. */
    filename: string
    /** Unique ID of the file */
    id: string
    /** Type of the file */
    type: string
    /** Side of the file */
    side: WDODocumentSubmitFileSide
    /** Status of the processing */
    status: WDODocumentStatus
    /** Possible errors */
    errors?: string[]
}

/* @internal */
export enum WDODocumentStatus {
    /** Document was accepted */
    accepted = "ACCEPTED",
    /** Document is being uploaded to the verification system by the backend */
    uploadInProgress = "UPLOAD_IN_PROGRESS",
    /** Document is being processed */
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

/* @internal */
export interface WDODocumentSubmitFile {
    /** Name of the file (with a path) */
    filename: string
    /** Type of the document */
    type: string
    /** Side of the document (for example, front side of the ID card) */
    side: WDODocumentSubmitFileSide
    /** Original document ID in case of re-upload */
    originalDocumentId?: string
    /** Base64 encoded data image. */
    data: Base64URLString
}

/* @internal */
export interface WDODocumentStatusResponse {
    /** Overall status */
    status: WDODocumentStatus
    /** Status for each document. */
    documents: WDODocument[]
}

/* @internal */
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
    /** Type of the document.
     * Expected values like: `ID_CARD`, `PASSPORT`, `DRIVING_LICENSE`.
     * All possible values can be found at backend implementation:
     * https://github.com/wultra/enrollment-server/blob/develop/enrollment-server-onboarding-domain-model/src/main/java/com/wultra/app/enrollmentserver/model/enumeration/DocumentType.java
     * Expected/possible values can be obtained from `WDOConfigurationService.getConfiguration()`.
     * */
    type: string
    /** Number of sides the document has */
    sideCount: number
}

/** Group of documents in the configuration */
export interface WDOConfigurationDocumentGroup {
    /** Number of required documents in the group */
    requiredDocumentsCount: number
    /** Documents in the group */
    items: Array<WDOConfigurationDocument>
}

/** Configuration for the onboarding process */
export interface WDOConfigurationResponse {
    /** Is the onboarding process enabled */
    enabled: boolean
    /** Is OTP required for the first part - identification/activation. */
    otpForIdentification: boolean
    /** Is OTP required for the second part - identity verification. */
    otpForIdentityVerification: boolean
    /** Documents required for identity verification. */
    documents: {
        /** Number of total required documents */
        totalRequiredDocumentsCount: number
        /** Groups of documents */
        groups: Array<WDOConfigurationDocumentGroup>
    }
}

/* @internal */
export interface WDOFinishActivationResponse {
    /** Activation code to be used for PowerAuth activation */
    activationCode: string
}