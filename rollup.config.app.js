import typescript from 'rollup-plugin-typescript2'
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

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

// Test app configuration is read from the gitignored `.env` file and injected in place of `__WDO_ENV__`.
const envFile = path.resolve(appCordovaDir, '.env')
let envJson = "{}"
const injectEnvPlugin = {
  name: "inject-env",
  buildStart() {
    this.addWatchFile(envFile)
    if (!fs.existsSync(envFile)) {
      this.error(`Missing ${envFile}. Copy ${appCordovaDir}/.env.example to ${appCordovaDir}/.env and fill in the values.`)
    }
    envJson = JSON.stringify(parseEnv(fs.readFileSync(envFile, 'utf8')))
  },
  transform(code) {
    if (!code.includes("__WDO_ENV__")) return null
    return { code: code.replace(/\b__WDO_ENV__\b/g, envJson), map: null }
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
      stripCordovaImportsPlugin,
      injectEnvPlugin
    ]
  }
]