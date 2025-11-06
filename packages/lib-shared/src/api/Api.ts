/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessResponse } from './OnboardingObjects'
import { WDOEndpoint, WDOEndpoints } from './Endpoints'


export abstract class WDOBaseApi {

    // Abstract API call method to be implemented in subclasses

    protected abstract callApi<T>(requestObject: any, endpoint: WDOEndpoint): Promise<T>

    abstract canStartActivation(): Promise<boolean>

    // Activation endpoints

    activationStart(credentials: any): Promise<ProcessResponse> {
        const requestObject = { identification: credentials }
        return this.callApi(requestObject, WDOEndpoints.start)
    }

    activationCancel(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOEndpoints.cancel)
    }

    activationGetStatus(processId: string): Promise<ProcessResponse> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOEndpoints.getStatus)
    }

    activationResendOTP(processId: string): Promise<void> {
        const requestObject = { processId: processId }
        return this.callApi(requestObject, WDOEndpoints.resendOTP)
    }

    activationGetOTP(processId: string): Promise<{ otpCode: string }> {
        const requestObject = { processId: processId, otpType: "ACTIVATION" }
        return this.callApi(requestObject, { path: "/api/onboarding/otp/detail", e2eeScope: "APPLICATION" })
    }

    // Verification endpoints

}