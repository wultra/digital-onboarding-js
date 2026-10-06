# Copilot instructions for `digital-onboarding-js`

## Build and validation

- Use the repository Node version from `.nvmrc` (`v22`) and Yarn 4. Run `corepack enable && yarn install`; Yarn is authoritative even though a legacy `package-lock.json` is present.
- Fast compile-only command: `sh scripts/build.sh`
  - Runs Rollup once for the Cordova library.
  - Produces `packages/lib-cordova/lib/index.js`, its source map, and `index.d.ts`.
- CI/package command: `yarn packCordova`
  - Runs the compile-only build first.
  - Copies the root `README.md`, `LICENSE`, and `docs/` into `packages/lib-cordova/`
  - Produces `packages/lib-cordova/digital-onboarding-js.tgz`
  - This is the only command currently used by CI (`.github/workflows/ci.yml`)
- Local watch workflow: `yarn dev`
  - Watches the Cordova library build and the Cordova test app build
  - Rebuilds `packages/lib-cordova/lib/index.js` and `testapp-cordova/www/js/index.js`
  - Runs `scripts/update-cordova-app-js.js`, which copies/wraps the compiled JS into `testapp-cordova/platforms/**`
- `yarn packCordova` ultimately packs whatever is present in `packages/lib-cordova/lib/*`, so when changing TypeScript sources, confirm the generated Cordova artifacts were actually refreshed before trusting the tarball.
- There is no real lint script and no automated test suite in this repository today.
- There is no full-suite or single-test command today. `testapp-cordova/package.json` still contains Cordova's placeholder `test` script that exits with an error; validation is compilation plus manual testing in the Cordova app.

## High-level architecture

- This repository is a Cordova-first Digital Onboarding SDK that extends Wultra Mobile Authentication / PowerAuth. It talks to the onboarding backend (usually `.../enrollment-server-onboarding/`) and integrates external scan/presence SDKs such as BlinkID and iProov.
- `packages/lib-shared/src/` contains almost all real SDK logic:
  - `WDOBaseActivationService` handles onboarding start/status/cancel/resend OTP/activate.
  - `WDOBaseVerificationService` implements the verification flow as a server-driven state machine.
  - `WDOBaseConfigurationService` fetches process configuration from the backend.
  - `api/WDOApi.ts` and `api/WDOEndpoints.ts` translate service operations into PowerAuth Networking calls.
  - `WDOVerificationState.ts`, `WDOVerificationScanProcess.ts`, `WDODocumentFile.ts`, `WDOError.ts`, and `WDOLogger.ts` define the public flow/state model.
- `WDOPlatform` is the cross-platform abstraction seam. Shared services depend on its static `cache`, `networking`, `powerAuth`, and `utils` integrations instead of importing Cordova APIs directly.
- Backend operations flow from a shared service to `WDOApi`, then through metadata in `api/WDOEndpoints.ts` into the platform networking adapter. Endpoint metadata selects unsigned, PowerAuth-signed, or token-authenticated calls and the end-to-end encryption scope.
- `packages/lib-cordova/` is the actual publishable plugin:
  - `src/index.ts` re-exports shared API types and installs Cordova implementations into `WDOPlatform`
  - `src/WDOCordovaPlatform.ts` bridges secure storage, PowerAuth, networking, and environment metadata
  - `plugin.xml` exposes the bundle as a Cordova plugin and merges it onto `window`
- `testapp-cordova/` is a manual integration harness, not an automated test project. Its `src/index.ts` exercises configuration fetch, activation, document selection/upload, presence check, OTP handling, and optional finish-activation against a real/demo backend.
- `rollup.config.lib.js` currently builds only the Cordova package. React Native output is scaffolded but commented out, and `packages/lib-react-native` is not part of the active build/publish path.

## Key conventions

- Treat verification as a server-driven flow, not a fixed client wizard. `WDOVerificationService.status()` determines the next screen through `WDOVerificationStateType`, and the docs in `docs/Verifying-User.md` describe the intended state transitions.
- A fresh `WDOVerificationService` instance must call `status()` before most follow-up actions. The service stores `processId` in `lastStatus`, and methods such as `consentGet()`, `start()`, `documentsInitSDK()`, `documentsSubmit()`, `presenceCheckInit()`, `verifyOTP()`, and `finishActivation()` rely on that cached status.
- Resume behavior is intentional:
  - `WDOActivationService` stores activation-process data in secure storage under `wdopd_${powerauth.instanceId}`
  - `WDOVerificationService` stores document-scan progress under `wdocp_${processId}`
  - `WDOVerificationScanProcess` reads the old `v1:` cache format and writes versioned v2 JSON. Preserve backward-compatible cache reads when evolving this data.
  - Do not replace persistent state with in-memory-only state unless you intentionally want to break cross-restart resume behavior.
- Preserve document re-upload behavior. `WDODocumentFile.fromScannedDocument()` and `documentsSubmit()` intentionally carry or recover `originalDocumentId` so rejected document sides overwrite previous uploads instead of creating duplicates.
- If you change public exports, update `packages/lib-cordova/src/index.ts`. That file is the single Cordova entry point that gets bundled into `lib/index.js` and exposed through `plugin.xml`.
- Define backend authentication and E2EE behavior in `WDOEndpoints.ts`, not ad hoc at call sites. `WDOApi.callApi()` wraps payloads as `{ requestObject }`, supplies possession authentication for signed/token endpoints, maps response errors to `WDOError`, and permits missing response data only when `returnsData` is false.
- Cordova runtime modules such as `cordova-powerauth-mobile-sdk` and `cordova-powerauth-networking` are intentionally stripped from the final bundle by Rollup because Cordova injects them at runtime. Do not "fix" those imports into normal bundled dependencies.
- `changeAcceptLanguage()` on activation and verification services is only a thin pass-through to the underlying networking integration; localized texts still depend on server configuration.
- `WDOError` intentionally carries richer onboarding/OTP information than a plain `Error` object, including remaining-attempt parsing from PowerAuth error payloads. Preserve that behavior when modifying error handling.
- `WDOLogger` only covers SDK-level logs. Networking verbosity is configured separately through `cordova-powerauth-networking`.
- `yarn dev` assumes the Cordova test app already has generated platform folders under `testapp-cordova/platforms/**`, because the sync script writes directly into those platform assets.
- TypeScript source files under the SDK packages use the repository Apache 2.0/SPDX header; retain it in new source files.

## Releases and branching

- Branch from and open pull requests into `develop`.
- On non-release branches, keep the Cordova package and plugin versions at `0.0.1-dev`.
- Prepare coordinated package, plugin, and changelog updates with `sh scripts/prepare-release.sh -v X.Y.Z`. Pass `--verify` to check a prepared release and `--prepare-dev` after a release to restore development metadata.
