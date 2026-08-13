/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOApi } from './WDOApi'
import { WDOPowerAuth } from '../WDOPlatform'
import { WDOBaseActivationService } from '../WDOActivationService'
import { WDOBaseVerificationService } from '../WDOVerificationService'

/**
 * Strategy where the getOTP endpoint is located.
 */
export type WDOGetOTPEndpointStrategy =
    /** Part of the enrollment-onboarding-server. */
    | { type: "eso" }
    /**
     * Mock server - automatic.
     *
     * For example, when deployment-mtoken-eso-dev.test.com is the url of the ESO server,
     * then path to the mock API is deployment-mtoken-eso-mock-dev.test.com/otp/detail.
     */
    | { type: "automaticMock" }
    /** Exact url of the OTP endpoint (path including). */
    | { type: "custom", url: string }

/**
 * Demo endpoints available only in Wultra Demo systems.
 *
 * This service operates against the same Wultra Onboarding server as `WDOActivationService`/`WDOVerificationService` -
 * construct it with the same `powerauth` instance and `baseUrl`.
 */
export abstract class WDOBaseDemoEndpointsService<TPowerAuth extends WDOPowerAuth> {

    /* @internal */
    private readonly api: WDOApi<TPowerAuth>

    /* @internal */
    private readonly baseUrl: string

    /**
     * Creates service instance
     *
     * @param powerauth Configured PowerAuth instance.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    constructor(powerauth: TPowerAuth, baseUrl: string) {
        this.api = new WDOApi(powerauth, baseUrl)
        this.baseUrl = baseUrl
    }

    /**
     * Demo endpoint available only in Wultra Demo systems.
     *
     * @param service Activation or verification service instance with an active process.
     * @param strategy Which endpoint strategy should be used for OTP retrieval. Defaults to `{ type: "automaticMock" }`.
     */
    async getOTP(service: WDOBaseActivationService<any> | WDOBaseVerificationService<any, any>, strategy: WDOGetOTPEndpointStrategy = { type: "automaticMock" }): Promise<string> {
        const processId: string | undefined = service instanceof WDOBaseActivationService
            ? await (service as any).processId()
            : (service as any).lastStatus?.processId
        if (!processId) {
            throw new Error("Process ID is not available")
        }
        const otpType = service instanceof WDOBaseActivationService ? "ACTIVATION" : "USER_VERIFICATION"
        switch (strategy.type) {
            case "eso":
                return (await this.api.activationGetOTP(processId, otpType)).otpCode
            case "automaticMock":
                return wdoFetchOtpFromMockEndpoint(wdoMockUrlFromEsoUrl(this.baseUrl), processId, otpType)
            case "custom":
                return wdoFetchOtpFromMockEndpoint(strategy.url, processId, otpType)
        }
    }
}

function wdoMockUrlFromEsoUrl(esoBaseUrl: string): string {
    const eso = new URL(esoBaseUrl)
    const mockHost = eso.host.replace("-eso", "-eso-mock")
    return `${eso.protocol}//${mockHost}/otp/detail`
}

// Note: This endpoint is not part of the standard onboarding API. It has no authentication or encryption,
// so it must be used only for testing against Wultra Demo systems and never in production.
async function wdoFetchOtpFromMockEndpoint(url: string, processId: string, otpType: string): Promise<string> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: processId, otpType: otpType })
    })

    if (!response.ok) {
        throw new Error(`Failed to retrieve mock OTP: HTTP ${response.status}`)
    }

    // `otpCode` is read via string-literal property access on the parsed JSON, so unlike Android's
    // reflection-based Gson mapping, it needs no @SerializedName-equivalent to survive JS minification.
    const data = await response.json()
    if (!data.otpCode) {
        throw new Error(`Mock OTP response did not contain otpCode: ${JSON.stringify(data)}`)
    }

    return data.otpCode
}
