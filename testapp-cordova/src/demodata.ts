// Server configuration
export const serverCredentials = {
    esUrl: "", // e.g. "https://powerauth-server-example.com/enrollment-server/"
    esoUrl: "", // e.g. "https://powerauth-server-example.com/enrollment-server-onboarding/"
    paConfig: "", // BASe64-encoded PowerAuth configuration
    authorization: "" // Base64-encoded Basic Auth credentials for the server API (just the part after "Basic ")
}

export const otpMockStrategy = { type: "automaticMock" } as const
export const blinkIdIos = ""
export const blinkIdAndroid = ""