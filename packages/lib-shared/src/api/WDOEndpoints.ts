/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WDOEndpoint {
    path: string // Endpoint path, starting with a slash, for example "/pa/myendpoint"
    e2eeScope: "ACTIVATION" | "APPLICATION" | "NONE" // Configuration for end-to-end encryption.
    uriId?: string // URI ID used for signature calculation. Only for signed endpoints.
    tokenName?: string // Name of the token used for authentication. Only for signed-with-token endpoints.
    returnsData: boolean // Indicates whether the endpoint response contains data object.
}

export class WDOActivationEndpoints {
    
    static readonly start: WDOEndpoint = {
        path: "/api/onboarding/start",
        e2eeScope: "APPLICATION",
        returnsData: true
    }

    static readonly cancel: WDOEndpoint = {
        path: "/api/onboarding/cleanup",
        e2eeScope: "APPLICATION",
        returnsData: false
    }

    static readonly resendOTP: WDOEndpoint = {
        path: "/api/onboarding/otp/resend",
        e2eeScope: "APPLICATION",
        returnsData: false
    }

    static readonly getStatus: WDOEndpoint = {
        path: "/api/onboarding/status",
        e2eeScope: "APPLICATION",
        returnsData: true
    }
}

export class WDOVerificationEndpoints {

    static readonly getStatus: WDOEndpoint = {
        path: "/api/identity/status",
        e2eeScope: "NONE",
        tokenName: "possession_universal",
        returnsData: true
    }

    static readonly init: WDOEndpoint = {
        path: "/api/identity/init",
        uriId: "/api/identity/init",
        e2eeScope: "NONE",
        returnsData: false
    }

    static readonly cancel: WDOEndpoint = {
        path: "/api/identity/cleanup",
        uriId: "/api/identity/cleanup",
        e2eeScope: "NONE",
        returnsData: false
    }

    static readonly consentText: WDOEndpoint = {
        path: "/api/identity/consent/text",
        tokenName: "possession_universal",
        e2eeScope: "NONE",
        returnsData: true
    }

    static readonly consentApprove: WDOEndpoint = {
        path: "/api/identity/consent/approve",
        uriId: "/api/identity/consent/approve",
        e2eeScope: "NONE",
        returnsData: false
    }

    static readonly documentScanSdkInit: WDOEndpoint = {
        path: "/api/identity/document/init-sdk",
        uriId: "/api/identity/document/init-sdk",
        e2eeScope: "ACTIVATION",
        returnsData: true
    }

    static readonly v2submitDocuments: WDOEndpoint = {
        path: "/api/v2/identity/document/submit",
        tokenName: "possession_universal",
        e2eeScope: "ACTIVATION",
        returnsData: false
    }

    static readonly documentsStatus: WDOEndpoint = {
        path: "/api/identity/document/status",
        tokenName: "possession_universal",
        e2eeScope: "NONE",
        returnsData: true
    }

    static readonly presenceCheckInit: WDOEndpoint = {
        path: "/api/identity/presence-check/init",
        uriId: "/api/identity/presence-check/init",
        e2eeScope: "ACTIVATION",
        returnsData: true
    }

    static readonly presenceCheckSubmit: WDOEndpoint = {
        path: "/api/identity/presence-check/submit",
        uriId: "/api/identity/presence-check/submit",
        e2eeScope: "NONE",
        returnsData: false
    }

    static readonly resendOTP: WDOEndpoint = {
        path: "/api/identity/otp/resend",
        uriId: "/api/identity/otp/resend",
        e2eeScope: "NONE",
        returnsData: false
    }

    static readonly verifyOTP: WDOEndpoint = {
        path: "/api/identity/otp/verify",
        e2eeScope: "ACTIVATION",
        returnsData: true
    }

    static readonly finishActivation: WDOEndpoint = {
        path: "/api/identity/activation",
        uriId: "/api/identity/activation",
        e2eeScope: "ACTIVATION",
        returnsData: true
    }
}