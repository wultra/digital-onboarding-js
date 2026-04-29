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

## Checklist

- Fetch and keep `WDOConfigurationResponse.otpResendPeriodSeconds` for the active process type, and handle `undefined` for older backends.
- Update call sites that read `WDOOtpState.otpResendPeriodSeconds`.
- Stop relying on OTP resend timing from `status()` and `verifyOTP()` results.
