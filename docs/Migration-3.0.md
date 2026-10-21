# Migration from 2.x to 3.0.x

This guide covers public API changes between `2.x` and `3.0.x`.

## Breaking Changes

1. Read OTP resend cooldown from configuration instead of verification status.

```typescript
const configuration = await configurationService.getConfiguration("onboarding")
const otpResendPeriodSeconds = configuration.otpResendPeriodSeconds
```

`otpResendPeriodSeconds` is optional and can be `undefined` when you are still integrating with an older backend that does not return the field yet.

2. Update OTP state handling.

Before:

```typescript
if (state.type === WDOVerificationStateType.otp) {
    const remainingAttempts = state.remainingAttempts
    const resendCooldown = state.otpResendPeriodSeconds
}
```

After:

```typescript
if (state.type === WDOVerificationStateType.otp) {
    const remainingAttempts = state.remainingAttempts
    const resendCooldown = configuration.otpResendPeriodSeconds
}
```

3. OTP helpers moved from services to `WDODemoEndpointsService`.

Before:

```typescript
const otp = await activationService.getOTP()
const otp = await verificationService.getOTP()
```

After:

```typescript
import { WDODemoEndpointsService } from "cordova-digital-onboarding"

const demoEndpointsService = new WDODemoEndpointsService(powerAuth, baseUrl)
const otp = await demoEndpointsService.getOTP(activationService)
const otp = await demoEndpointsService.getOTP(verificationService)
```

`WDODemoEndpointsService` is constructed the same way as `WDOActivationService`/`WDOVerificationService` (same `powerauth` instance and `baseUrl`). The endpoint strategy (`WDOGetOTPEndpointStrategy`) defaults to `{ type: "automaticMock" }` and can be overridden as a second argument, e.g. `demoEndpointsService.getOTP(activationService, { type: "custom", url: "https://example.com/otp/detail" })`.

## Checklist

- Fetch and keep `WDOConfigurationResponse.otpResendPeriodSeconds` for the active process type, and handle `undefined` for older backends.
- Update call sites that read `WDOOtpState.otpResendPeriodSeconds`.
- Stop relying on OTP resend timing from `status()` and `verifyOTP()` results.
- Move demo OTP retrieval to a `WDODemoEndpointsService` instance's `getOTP(...)`.
