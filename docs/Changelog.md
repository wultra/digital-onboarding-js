# Changelog

## 2.0.2 (Mar, 2026)

- When re-uploading a rejected document without providing `originalDocumentId`, the SDK now resolves it automatically.
  - Matching is based on the server data provided during the `status()` call, which includes the list of documents and their sides that the user already uploaded.
- `WDODocumentSide` enum values changed from lowercase (`"front"`, `"back"`) to uppercase (`"FRONT"`, `"BACK"`) to match server API values.

## 2.0.1 (Mar, 2026)

- Fixed: Document scan flow no longer proceeds to processing when additional documents are still selected locally.

## 2.0.0 (Mar, 2026)

- ⚠️ Minimal required enrollment server version is now `2.1.0`
- `WDODocumentType` changed from an enum to a type alias of `string` (see `WDODocumentFile.ts`) to better accommodate dynamic configuration of scanned documents. Also removed the `WDODocumentSubmitFileType` enum for the same reason.
- Added `processType` to the `WDOVerificationService` to allow clients to distinguish between different processes.
- `WDOVerificationService.status` now returns additional information about the process, such as `processType` and `processId`.
- `WDOEndStateState` now contains optional `rejectReason` property when the `reason` is `rejected`. This contains the reject reason if provided by the server.
- Removed `otpResendPeriodSeconds` from `WDOVerificationService`. The value is now available in the `WDOOtpState` returned by `status()` and `verifyOTP()`.
- `WDOConfigurationResponse` now contains `useTemporaryActivation` to indicate if the onboarding process is configured with temporary activation that should be exchanged for the permanent one via the new `finishActivation` method in the verification flow.
- `WDOConfigurationDocument` now contains optional `country` property to specify the country of origin of the document as ISO 3166-1 alpha-3 code.

## 1.3.0 (Feb, 2026)

- Added `onboardingApproval` to the `WDOStatusCheckReason` when the process is waiting for institution approval.
- SDK now supports a server that is configured to support multiple BlinkID applications (bundle IDs/Package Names). The `origin` parameter is now sent to the server to identify the application.

## 1.2.0 (Jan, 2026)

- **Breaking:** New `finishActivation` state in `WDOVerificationService` to complete the user verification process by activating a new PowerAuth instance.
  - New method must be called by the client when handling the `finishActivation` state in the verification flow, i.e. after all verification steps (identity, documents, presence, etc.) have succeeded but before the new `PowerAuth` instance is used anywhere else in the app: `finishActivation(newPaInstance: PowerAuth, activationName: string, password: WDOPowerAuthPassword, validatePassword: boolean)`.
- **Breaking:** Changed configuration endpoint response to include document groups instead of a flat list of documents.

## 1.1.0 (Dec, 2025)

- PowerAuth Cordova SDK dependency now requires v. `4.2.0`.
- Process cache is now persistent across app restarts.
- Changes to `WDOError`:
    - added `reason: WDOErrorReason` property to specify the error cause.
    - added `allowOnboardingOtpRetry: boolean` property to indicate if OTP retry is allowed (during activation failure).
    - modified `onboardingOtpRemainingAttempts` to parse the remaining attempts from the original exception (during activation failure).
- `WDOActivaitonService` changes:
   - `hasActiveProcess()` now returns Promise<boolean> instead of boolean. 
   - `clear()` is now asynchronous and returns Promise<void>.
- `WDOActivaitonService` changes:
   - removed `consent` state
   - replaced `consentApprove` with `start` method with a `consent` argument.
   - `consentGet` now returns Promise<string> instead of the verification state.
   - `documentsInitSDK` method now returns strongly typed response.
   - `presenceCheckInit` method now returns strongly typed response.
   - `intro` state now contains `consentRequired: boolean` property in the corresponding union type.

## 1.0.0 (Nov, 2025)

Initial release.
