/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDODocumentStatusResponse, WDODocumentSubmitFile, WDOProcessResponse, WDOVerifyOTPResponse, WDOConfigurationResponse, WDOIdentityStatusResponse, WDOFinishActivationResponse } from './WDONetworkingObjects'
import { WDOEndpoint, WDOActivationEndpoints, WDOVerificationEndpoints } from './WDOEndpoints'

export abstract class WDOBaseApi {

    // Abstract API call method to be implemented in subclasses

    protected abstract callApi<T>(requestObject: any, endpoint: WDOEndpoint, authObject?: any): Promise<T>

    abstract canStartActivation(): Promise<boolean>

    // Configuration endpoints

    getConfiguration(processType: string): Promise<WDOConfigurationResponse> {
        const requestObject = { processType: processType }
        return this.callApi(requestObject, { path: "/api/configuration", e2eeScope: "APPLICATION", returnsData: true })
    }

    // Activation endpoints

    activationStart(credentials: any, processType?: string): Promise<WDOProcessResponse> {
        const requestObject = { identification: credentials, processType: processType }
        return this.callApi(requestObject, WDOActivationEndpoints.start)
    }

    activationCancel(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.cancel)
    }

    activationGetStatus(processId: string): Promise<WDOProcessResponse> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.getStatus)
    }

    activationResendOTP(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOActivationEndpoints.resendOTP)
    }

    activationGetOTP(processId: string, otpType: "ACTIVATION" | "USER_VERIFICATION"): Promise<{ otpCode: string }> {
        const requestObject = { processId: processId, otpType: otpType }
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
        const requestObject = { processId: processId, consentType: "GDPR" }
        return this.callApi(requestObject, WDOVerificationEndpoints.consentText)
    }

    verificationResolveConsent(processId: string, approved: boolean): Promise<void> {
        const requestObject = { processId: processId, approved: approved, consentType: "GDPR" }
        return this.callApi(requestObject, WDOVerificationEndpoints.consentApprove)
    }

    verificationInitScanSDK(processId: string, challenge: string): Promise<any> {
        const requestObject = { processId: processId, attributes: { 'sdk-init-token': challenge }} 
        return this.callApi(requestObject, WDOVerificationEndpoints.documentScanSdkInit)
    }

    verificationSubmitDocuments(processId: string, resubmit: boolean, documents: WDODocumentSubmitFile[]): Promise<void> {
        const requestObject = { 
            processId: processId, 
            resubmit: resubmit, 
            documents: documents 
        }
        // TODO: there should be longer timeout!
        return this.callApi(requestObject, WDOVerificationEndpoints.v2submitDocuments)
    }

    verificationDocumentsStatus(processId: string): Promise<WDODocumentStatusResponse> {
        const requestObject = { processId: processId }
        // TODO: longer timeout?
        return this.callApi(requestObject, WDOVerificationEndpoints.documentsStatus)
    }

    verificationPresenceCheckInit(processId: string): Promise<{ sessionAttributes: any }> {
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

    verifyOTP(processId: string, otp: string): Promise<WDOVerifyOTPResponse> {
        const requestObject = { processId: processId, otpCode: otp }
        return this.callApi(requestObject, WDOVerificationEndpoints.verifyOTP)
    }
    
    verificationFinishActivation(authObject: any, processId: string, userIdentification?: any): Promise<WDOFinishActivationResponse> {
        const requestObject = { processId: processId, identification: userIdentification }
        return this.callApi(requestObject, WDOVerificationEndpoints.finishActivation, authObject)
    }
}