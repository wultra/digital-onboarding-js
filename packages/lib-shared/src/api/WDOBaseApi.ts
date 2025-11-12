/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentStatusResponse, DocumentSubmitFile, ProcessResponse, VerifyOTPResponse, WDOIdentityStatusResponse } from './WDONetworkingObjects'
import { WDOEndpoint, WDOActivationEndpoints, WDOVerificationEndpoints } from './WDOEndpoints'


export abstract class WDOBaseApi {

    // Abstract API call method to be implemented in subclasses

    protected abstract callApi<T>(requestObject: any, endpoint: WDOEndpoint): Promise<T>

    abstract canStartActivation(): Promise<boolean>

    // Activation endpoints

    activationStart(credentials: any): Promise<ProcessResponse> {
        const requestObject = { identification: credentials }
        return this.callApi(requestObject, WDOActivationEndpoints.start)
    }

    activationCancel(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.cancel)
    }

    activationGetStatus(processId: string): Promise<ProcessResponse> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.getStatus)
    }

    activationResendOTP(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.resendOTP)
    }

    activationGetOTP(processId: string): Promise<{ otpCode: string }> {
        const requestObject = { processId: processId, otpType: "ACTIVATION" }
        return this.callApi(requestObject, { path: "/api/onboarding/otp/detail", e2eeScope: "APPLICATION", returnsData: true })
    }

    // Verification endpoints

    verificationStatus(): Promise<WDOIdentityStatusResponse> {
        const requestObject = {}
        return this.callApi(requestObject, WDOVerificationEndpoints.getStatus)
    }

    verificationStart(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOVerificationEndpoints.init)
    }

    verificationCleanup(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOVerificationEndpoints.cancel)
    }

    verificationGetConsentText(processId: string): Promise<{ consentText: string }> {
        const requestObject = { processId: processId, consentType: "GDPR" } // TODO: hardcoded type
        return this.callApi(requestObject, WDOVerificationEndpoints.consentText)
    }

    verificationResolveConsent(processId: string, approved: boolean): Promise<void> {
        const requestObject = { processId: processId, approved: approved, consentType: "GDPR" } // TODO: hardcoded type
        return this.callApi(requestObject, WDOVerificationEndpoints.consentApprove)
    }

    verificationInitScanSDK(processId: string, challenge: string): Promise<any> { // TODO: proper return type?
        const requestObject = { processId: processId, attributes: { 'sdk-init-token': challenge }} 
        return this.callApi(requestObject, WDOVerificationEndpoints.documentScanSdkInit)
    }

    // TODO: data = base64 encoded zip. How to do it?
    verificationSubmitDocuments(processId: string, data: string, resubmit: boolean, documents: DocumentSubmitFile[]): Promise<void> {
        const requestObject = { processId: processId, data: data, resubmit: resubmit, documents: documents }
        // TODO: there should be longer timeout!
        return this.callApi(requestObject, WDOVerificationEndpoints.submitDocuments)
    }

    verificationDocumentsStatus(processId: string): Promise<DocumentStatusResponse> {
        const requestObject = { processId: processId }
        // TODO: longer timeout?
        return this.callApi(requestObject, WDOVerificationEndpoints.documentsStatus)
    }

    verificationPresenceCheckInit(processId: string): Promise<{ attributes: any }> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOVerificationEndpoints.presenceCheckInit)
    }

    verificationPresenceCheckSubmit(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOVerificationEndpoints.presenceCheckSubmit)
    }

    verificationResendOTP(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOVerificationEndpoints.resendOTP)
    }

    verifyOTP(processId: string, otp: string): Promise<VerifyOTPResponse> {
        const requestObject = { processId: processId, otpCode: otp }
        return this.callApi(requestObject, WDOVerificationEndpoints.verifyOTP)
    }
}