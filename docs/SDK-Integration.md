# SDK Integration

## Cordova Installation

### Requirements

- Cordova >=12.0.0
- Android 7.0 (API 24)+ or iOS 15.0+
- [PowerAuth Mobile JS SDK](https://github.com/wultra/react-native-powerauth-mobile-sdk) 5.0.0 or newer
- [PowerAuth Networking JS SDK](https://github.com/wultra/networking-js) 2.0.0 or newer
- Android builds: Kotlin 2.1.20, Android Gradle Plugin 8.9.1 and Gradle 8.11.1 or compatible newer versions

### Add via cordova CLI

Add `cordova-digital-onboarding` package to your Cordova project using the following command:

```bash
cordova plugin add cordova-digital-onboarding
```

The plugin declares `cordova-powerauth-mobile-sdk` and `cordova-powerauth-networking` as plugin dependencies. Compatible versions are installed automatically when missing. If an incompatible version is already installed, update it before adding this plugin.

## Read next

- [Process Configuration](Process-Configuration.md)
