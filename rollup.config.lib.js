import typescript from 'rollup-plugin-typescript2'
import { dts } from "rollup-plugin-dts"

// Cordova Library Configuration
const expectedCordovaModules = ["cordova-powerauth-mobile-sdk", "cordova", "cordova-powerauth-networking", "cordova-digital-onboarding", "iproov-cordova-plugin", "blinkid-cordova-plugin"]

// Cordova Library Configuration
const libCordovaDir = 'packages/lib-cordova'
const libCordovaInput = `${libCordovaDir}/src/index.ts`
const libCordovaOutput = `${libCordovaDir}/lib/index.js`
const libCordovaOutputDts = `${libCordovaDir}/lib/index.d.ts`

// React Native Library Configuration
const libRNDir = 'packages/lib-react-native'
const libRNInput = `${libRNDir}/src/index.ts`
const libRNOutput = `${libRNDir}/lib`

// Plugin to strip copyright comments from .d.ts files
const stripCopyrightPlugin = {
  name: "strip-copyright",
  generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        // Only process declaration files
        if (!fileName.endsWith(".d.ts")) continue;

        const copyrightString = `/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: Apache-2.0
 */`

        const file = bundle[fileName];
        file.code = file.code.replaceAll(copyrightString,"").replaceAll("\n\n","\n").trimStart()
      }
    },
}

// Generate both the JavaScript bundle and the TypeScript declaration file
export default [

  /**************
   * CORDOVA
   **************/

  // Cordova Library
  {
    input: libCordovaInput,
    output: {
      file: libCordovaOutput,
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: `${libCordovaDir}/tsconfig.json`
      }), 
      // We dont want to import modules that will be supplied by Cordova environment
      // Cordova plugins are injected at runtime, so we need to strip these imports from the final bundle to not cause errors.
      {
        name: "remove-cordova-modules",
        transform(code, id) {
          return {
            code: code.replace(new RegExp(`^import.*(?:${expectedCordovaModules.map(m => `"${m}"`).join("|")}).*$`, "gm"), ""),
            map: null,
          };
        },
      }
    ]
  },
  // Cordova Library .d.ts
  {
    input: libCordovaInput,
    output: { 
      file: libCordovaOutputDts, 
      format: 'es'
    },
    plugins: [
      dts({ compilerOptions: { stripInternal: true } }),
      stripCopyrightPlugin
    ],
  }

  /**************
   * REACT NATIVE
   **************/

  // React Native Library
  // {
  //   input: libRNInput,
  //   output: {
  //     dir: libRNOutput,
  //     format: 'es',
  //   },
  //   external: ['react-native-powerauth-mobile-sdk', 'react-native'],
  //   plugins: [
  //     typescript({
  //       tsconfig: `${libRNDir}/tsconfig.json`
  //     })
  //   ]
  // },
  // // React Native .d.ts
  // {
  //   input: libRNInput,
  //   output: { 
  //     dir: libRNOutput,
  //     format: 'es'
  //   },
  //   plugins: [dts()],
  // }
]