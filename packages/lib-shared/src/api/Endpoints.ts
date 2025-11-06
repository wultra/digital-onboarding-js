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
}

export class WDOEndpoints {

    // Onboarding endpoints
    
    static start: WDOEndpoint = {
        path: "/api/onboarding/start",
        e2eeScope: "APPLICATION"
    }

    static cancel: WDOEndpoint = {
        path: "/api/onboarding/cleanup",
        e2eeScope: "APPLICATION"
    }

    static resendOTP: WDOEndpoint = {
        path: "/api/onboarding/otp/resend",
        e2eeScope: "APPLICATION"
    }

    static getStatus: WDOEndpoint = {
        path: "/api/onboarding/status",
        e2eeScope: "APPLICATION"
    }

    // Idenitification endpoints

}