// Values are read from `testapp-cordova/.env` and injected at build time by `rollup.config.app.js`.
// See `testapp-cordova/.env.example` for the available keys.
declare const __WDO_ENV__: Record<string, string | undefined>

const env = __WDO_ENV__

// Server configuration
export const serverCredentials = {
    esUrl: env.WDO_ES_URL ?? "",
    esoUrl: env.WDO_ESO_URL ?? "",
    paConfig: env.WDO_PA_CONFIG ?? "",
    authorization: env.WDO_AUTHORIZATION ?? ""
}

export const otpMockStrategy = { type: "automaticMock" } as const

// Empty keys skip the real BlinkID document-scanning SDK and fall back to the mocked document upload
export const blinkIdIos: string = env.WDO_BLINKID_LICENSE_IOS ?? ""
export const blinkIdAndroid: string = env.WDO_BLINKID_LICENSE_ANDROID ?? ""
