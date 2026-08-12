import { WDOActivationService, WDOVerificationService } from "cordova-digital-onboarding"

/**
 * Strategy for where the OTP retrieval endpoint is located.
 *
 * This is only useful when testing against a Wultra Demo/test system - it has no purpose in production.
 * Test-app-only helper (not part of the SDK's public API).
 */
export type GetOTPEndpointStrategy =
    /** Mock server - automatic host derivation ("-eso" -> "-eso-mock" in the ESO hostname). */
    | { type: "automaticMock" }
    /** Exact URL of the OTP endpoint (including path). */
    | { type: "custom", url: string }

/**
 * Demo-only helper for retrieving an OTP code directly from the server/mock service, without needing the
 * user to receive it via SMS or email. Only works against a Wultra Demo/test system - never use this in
 * a real app or in production.
 *
 * This is intentionally kept local to the test app (not part of the SDK's public API).
 */
export const DemoEndpoints = {
    /**
     * Retrieves an activation OTP code.
     *
     * @param service Activation service instance.
     * @param esoUrl Base URL of the Wultra Digital Onboarding server (used to derive the mock endpoint host).
     * @param strategy Which endpoint strategy should be used for OTP retrieval. Defaults to `{ type: "automaticMock" }`.
     */
    async getOTPForActivation(service: WDOActivationService, esoUrl: string, strategy: GetOTPEndpointStrategy = { type: "automaticMock" }): Promise<string> {
        const processId: string | undefined = await (service as any).processId()
        return getOTP(processId, esoUrl, "ACTIVATION", strategy)
    },

    /**
     * Retrieves a user-verification OTP code.
     *
     * @param service Verification service instance.
     * @param esoUrl Base URL of the Wultra Digital Onboarding server (used to derive the mock endpoint host).
     * @param strategy Which endpoint strategy should be used for OTP retrieval. Defaults to `{ type: "automaticMock" }`.
     */
    async getOTPForVerification(service: WDOVerificationService, esoUrl: string, strategy: GetOTPEndpointStrategy = { type: "automaticMock" }): Promise<string> {
        const processId: string | undefined = (service as any).lastStatus?.processId
        return getOTP(processId, esoUrl, "USER_VERIFICATION", strategy)
    }
}

async function getOTP(processId: string | undefined, esoUrl: string, otpType: "ACTIVATION" | "USER_VERIFICATION", strategy: GetOTPEndpointStrategy): Promise<string> {
    if (!processId) {
        throw new Error("Process ID is not available")
    }
    const url = strategy.type === "custom" ? strategy.url : mockUrlFromEsoUrl(esoUrl)
    return await fetchOtpFromMockEndpoint(url, processId, otpType)
}

function mockUrlFromEsoUrl(esoBaseUrl: string): string {
    const eso = new URL(esoBaseUrl)
    const mockHost = eso.host.replace("-eso", "-eso-mock")
    return `${eso.protocol}//${mockHost}/otp/detail`
}

// Note: This endpoint is not part of the standard onboarding API. It has no authentication or encryption,
// so it must be used only for testing against Wultra Demo systems and never in production.
async function fetchOtpFromMockEndpoint(url: string, processId: string, otpType: string): Promise<string> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: processId, otpType: otpType })
    })

    if (!response.ok) {
        throw new Error(`Failed to retrieve mock OTP: HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!data.otpCode) {
        throw new Error(`Mock OTP response did not contain otpCode: ${JSON.stringify(data)}`)
    }

    return data.otpCode
}
