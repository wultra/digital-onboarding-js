---
name: code-review
description: Review pull requests in the Cordova Digital Onboarding SDK repository. Use when reviewing public APIs, server-driven state, secure persistence, protocol integrity, or documentation changes.
---

# digital-onboarding-js review

Confirm PR target, head, and current checkout before reviewing; normal work targets `develop`. Default to **approve**. A finding must be a concrete PR-introduced defect with `path:line`, demonstrated impact, and a precise correction. Do not give formatting, style, or CI advice.

Do not post or submit GitHub content without explicit user approval. Prefix any postable wording with `🤖`.

## Public API, flow, and Cordova seam

`packages/lib-cordova/src/index.ts` is the sole publishable entry point for `cordova-digital-onboarding`. It exports onboarding state/data/errors/logging and declares `WDOActivationService`, `WDOVerificationService`, `WDOConfigurationService`, and `WDODemoEndpointsService`. Public export changes require matching declaration/package behavior.

Shared flow code is in `packages/lib-shared/src/`:

- `WDOBaseActivationService`: start, status, cancel, resend OTP, and activation resume data.
- `WDOBaseVerificationService`: server-driven verification status and consent, scanning, document submission, presence, OTP, and finish-activation steps.
- `api/WDOApi.ts` and `api/WDOEndpoints.ts`: request wrapping, authentication, E2EE scope, and response mapping.
- `WDOPlatform.ts`: platform abstraction; `lib-cordova/src/WDOCordovaPlatform.ts` supplies cache, PowerAuth, networking, and device integration.

The flow is not a fixed local wizard: `status()` selects the next `WDOVerificationState`. A new verification service must obtain status before methods that use cached `processId`. Flag a proven change that enables an action with missing/stale process state, skips a server transition, or reports a state inconsistent with server data.

## Security, serialization, and persistence

Endpoint metadata is the security policy. In `WDOEndpoints.ts`, preserve each endpoint's path, `uriId` versus `tokenName`, `returnsData`, and `e2eeScope`; `WDOApi.callApi()` wraps every payload as `{ requestObject }`, supplies possession authentication for signed/token calls, and maps failures to `WDOError`. Changes must not replace endpoint metadata with ad-hoc calls or weaken a signature, token, or E2EE scope.

Review the authentication distinction carefully: re-verification start and selected verification endpoints are possession-signed; token endpoints use `possession_universal`; application/activation/no encryption scopes are intentional. OTPs, identity documents/images, scan tokens, presence-session attributes, activation data, process IDs, authentication values, response payloads, and cryptograms must not become logged or exposed.

Preserve restart/resubmit semantics:

- `WDOActivationService` securely caches `wdopd_${powerauth.instanceId}`.
- `WDOVerificationScanProcess` uses `wdocp_${processId}`, reads legacy `v1:` data, and writes versioned v2 JSON.
- `WDODocumentFile.fromScannedDocument()` and `documentsSubmit()` retain/recover `originalDocumentId` so rejected sides overwrite rather than duplicate uploads.

The Cordova bundle intentionally strips runtime modules (`cordova-powerauth-mobile-sdk`, `cordova-powerauth-networking`, `iproov-cordova-plugin`, and `blinkid-cordova-plugin`) in `rollup.config.lib.js`; Cordova supplies them. `plugin.xml` merges the bundle onto `window`. Do not accept a change that bundles them or breaks the platform abstraction.

## Release, docs, and review evidence

Use `sh scripts/build.sh` for the focused compile and `yarn packCordova` for the CI/package path. The `testapp-cordova` project is a live-backend manual harness, not an automated test suite.

For a release-to-`develop` transition, root `package.json`, `packages/lib-cordova/package.json`, and `packages/lib-cordova/plugin.xml` must all declare `0.0.1-dev`. `.prepare-release.json` also requires the `docs/Changelog.md` TBA/release transition; check that public docs reflect changed API, server compatibility, state flow, or integration behavior.

Public documentation is under `docs/` (especially `SDK-Integration.md`, `Process-Configuration.md`, `Device-Activation.md`, and `Verifying-User.md`) plus `README.md`. Flag grammar only in changed public docs/JSDoc and only when the base branch is not a release branch. Do not report grammar elsewhere.
