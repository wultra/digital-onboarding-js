# Changelog

## TBA (Dec, 2025)

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
