# Migration from 3.0.x to 4.0.x

This guide covers changes between `3.0.x` and `4.0.x`. Version `4.0.x` moves to PowerAuth Mobile JS SDK `5.0.0` and PowerAuth Networking JS SDK `2.0.0`.

## Breaking Changes

1. Update the PowerAuth plugins.

The plugin requires PowerAuth Mobile JS SDK `5.0.0` or newer and PowerAuth Networking JS SDK `2.0.0` or newer. Compatible versions are installed automatically when missing. If older `cordova-powerauth-mobile-sdk` or `cordova-powerauth-networking` plugins are installed, update or remove them before adding this plugin. See the [PowerAuth Mobile JS SDK 5.0 migration guide](https://github.com/wultra/react-native-powerauth-mobile-sdk/blob/develop/docs/Version-5.0.md) for changes in PowerAuth itself.

2. Raise the iOS deployment target of your Cordova app to `15.0` or newer.

```xml
<platform name="ios">
    <preference name="deployment-target" value="15.0" />
</platform>
```

3. Create a reusable `PowerAuthPassword` with the options object.

When calling `finishActivation` with `validatePassword` set to `true`, the password must not be destroyed on use. PowerAuth Mobile JS SDK `5.0.0` takes an options object instead of a boolean.

Before:

```typescript
const password = await PowerAuthPassword.fromString(pin, false)
```

After:

```typescript
const password = await PowerAuthPassword.fromString(pin, { destroyOnUse: false })
```

4. Handle the updated activation status in `WDOVerificationServiceListener`.

The status passed to `powerAuthActivationStatusChanged` can now be `UNKNOWN` and is never `CREATED`.

5. Use request interceptors when calling `WPNNetworking` directly.

If your app uses `WPNNetworking` from PowerAuth Networking JS SDK, the `requestProcessor` argument of `call()` was removed. Pass `requestInterceptors` in `WPNConfig` to the `WPNNetworking` constructor instead. Interceptors synchronously receive and return a `WPNRequest`, including its `url`, and apply to every request made by that instance.

## Checklist

- Update or remove older `cordova-powerauth-mobile-sdk` and `cordova-powerauth-networking` plugins before adding this plugin.
- Set the iOS `deployment-target` preference in your app's `config.xml` to `15.0` or newer.
- Replace `PowerAuthPassword.fromString(pin, false)` and `new PowerAuthPassword(false)` with the `{ destroyOnUse: false }` options object.
- Handle `UNKNOWN` and stop expecting `CREATED` in `powerAuthActivationStatusChanged`.
- Move `WPNNetworking` request processing to `WPNConfig.requestInterceptors`.
