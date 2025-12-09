import typescript from 'rollup-plugin-typescript2'

// Cordova Library Configuration
const expectedCordovaModules = ["cordova-powerauth-mobile-sdk", "cordova", "cordova-powerauth-networking", "cordova-digital-onboarding", "iproov-cordova-plugin", "blinkid-cordova-plugin"]

// Cordova App Configuration
const appCordovaDir = 'testapp-cordova'

// We dont want to import modules that will be supplied by Cordova environment
// Cordova plugins are injected at runtime, so we need to strip these imports from the final bundle to not cause errors.
const stripCordovaImportsPlugin =  {
  name: "remove-cordova-modules",
  transform(code, id) {
    return {
      code: code.replace(new RegExp(`^import.*(?:${expectedCordovaModules.map(m => `"${m}"`).join("|")}).*$`, "gm"), ""),
      map: null,
    };
  },
}

// Generate both the JavaScript bundle and the TypeScript declaration file
export default [

  // Cordova App
  {
    input: `${appCordovaDir}/src/index.ts`,
    output: {
      file: `${appCordovaDir}/www/js/index.js`,
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: `${appCordovaDir}/tsconfig.json`
      }),
      stripCordovaImportsPlugin
    ]
  }
]