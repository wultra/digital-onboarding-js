import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// This script keeps generated JavaScript in sync with the already-installed Cordova platforms.
// It wraps the SDK bundle so Cordova can load it as a plugin module, mirrors the test app bundle
// into native platform assets, and applies one-time file overrides from testapp-cordova/patchfiles.
//
// This is a workaround, because Cordova creates a copy of the .js file only during the platform installation.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//
// FILE PATHS CONFIGURATION
//
// These paths are used to patch files in the cordova test app and to keep 
// the built SDK bundle in sync inside generated Cordova platform folders.

const moduleName = 'cordova-digital-onboarding.WultraDigitalOnboarding';
const paths = (() => {
    const testAppRoot = path.resolve(__dirname, '../testapp-cordova'); // test app root
    const libCordovaRoot = path.resolve(__dirname, '../packages/lib-cordova'); // cordova package root
    const platformRoots = {
        ios: path.resolve(testAppRoot, 'platforms/ios'), // folder where cordova ios platform is generated
        android: path.resolve(testAppRoot, 'platforms/android') // folder where cordova android platform is generated
    };
    const androidAssetsRoot = path.resolve(platformRoots.android, 'app/src/main/assets'); // Android assets root
    const pluginBundleFile = 'lib/index.js'; // Plugin bundle file
    const appBundleFile = 'www/js/index.js'; // App bundle file
    const pluginBundleAssetPath = path.join('plugins', 'cordova-digital-onboarding', pluginBundleFile); // Plugin bundle asset path

    return {
        roots: {
            libCordova: libCordovaRoot, // Built Cordova SDK package root.
            testApp: testAppRoot // Manual Cordova test app root.
        },
        platforms: {
            ...platformRoots,
            androidAssets: androidAssetsRoot // Android web assets root.
        },
        pluginBundle: {
            file: pluginBundleFile, // Built SDK bundle filename.
            source: path.resolve(libCordovaRoot, pluginBundleFile), // Watched SDK bundle produced by Rollup.
            destinations: [
                path.resolve(platformRoots.ios, 'www', pluginBundleAssetPath),
                path.resolve(platformRoots.ios, 'platform_www', pluginBundleAssetPath),
                path.resolve(androidAssetsRoot, 'www', pluginBundleAssetPath),
                path.resolve(platformRoots.android, 'platform_www', pluginBundleAssetPath)
            ]
        },
        appBundle: {
            file: appBundleFile, // Built test app entry bundle.
            source: path.resolve(testAppRoot, appBundleFile), // Watched test app bundle.
            destinations: [
                path.resolve(platformRoots.ios, appBundleFile),
                path.resolve(androidAssetsRoot, appBundleFile)
            ]
        },
        patch: {
            sourceRoot: path.resolve(testAppRoot, 'patchfiles'), // One-time overrides mirrored into the test app.
            destinationRoot: testAppRoot
        }
    };
})();

//
// MAIN SCRIPT EXECUTION
//
assertInstalledPlatforms(); // Fail fast when the Cordova test app has not been prepared yet.
applyPatchFiles(); // Apply platform overrides once when the script starts.
watchPluginBundleChanges(); // Keep the plugin bundle in sync inside already-generated Cordova platform folders.
watchAppBundleChanges(); // Keep the compiled test app entrypoint mirrored into native platform assets.

//
// HELPER FUNCTIONS
//
function applyPatchFiles() { // Copy every override from patchfiles into the matching place under the test app.
    function getFilesRecursively(directory) { // Collect every file below patchfiles.
        const files = [];

        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.resolve(directory, entry.name);

            if (entry.isDirectory()) {
                files.push(...getFilesRecursively(entryPath));
                continue;
            }

            files.push(entryPath);
        }

        return files;
    }

    if (!fs.existsSync(paths.patch.sourceRoot)) {
        console.log(`\x1b[33mPatchfiles directory not found, skipping patch merge.\x1b[0m`);
        return;
    }

    const patchFiles = getFilesRecursively(paths.patch.sourceRoot);

    if (patchFiles.length === 0) {
        console.log(`\x1b[33mNo patch files found in ${paths.patch.sourceRoot}, skipping patch merge.\x1b[0m`);
        return;
    }

    console.log(`\n\x1b[34mApplying patch files from ${paths.patch.sourceRoot}...\x1b[0m`);

    for (const patchFile of patchFiles) {
        const relativePath = path.relative(paths.patch.sourceRoot, patchFile);
        const destinationPath = path.resolve(paths.patch.destinationRoot, relativePath);
        const action = fs.existsSync(destinationPath) ? 'Replaced' : 'Added';

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(patchFile, destinationPath);

        console.log(`\x1b[32m${action}: ${relativePath}\x1b[0m`);
    }

    console.log(`\x1b[32mPatch file merge completed.\x1b[0m\n`);
}

function assertInstalledPlatforms() { // Make sure both generated Cordova platform folders already exist.
  for (const [name, path] of Object.entries(paths.platforms)) {
    if (name === 'androidAssets') continue;
      
    if (!fs.existsSync(path) || !fs.statSync(path).isDirectory()) {
      throw new Error(
        `Missing Cordova platform folder: ${name}. Install both iOS and Android platforms before running this script.`
        );
      }
    }
}

function watchPluginBundleChanges() { // Watch the built SDK bundle and propagate it into generated plugin assets.
    console.log(`Watching for changes in ${paths.pluginBundle.source}...`);

    fs.watchFile(paths.pluginBundle.source, { interval: 500 }, (curr, prev) => {
        try {
            console.log(`\n\x1b[34mLoading ${paths.pluginBundle.file} content and wrapping it in a Cordova define...\x1b[0m`);
            const fileContent = fs.readFileSync(paths.pluginBundle.source, 'utf8'); // Read the built SDK bundle.
            const newContent = `cordova.define("${moduleName}", function(require, exports, module) {\n${fileContent}\n});\n`;
            for (const destinationPath of paths.pluginBundle.destinations) { // Overwrite generated plugin files in both platforms.
                fs.writeFileSync(destinationPath, newContent, 'utf8');
            }
            console.log(`\x1b[32mLib js file copied successfully to the Cordova app.\x1b[0m\n`);
        } catch (err) {
            console.error(`\x1b[31mFailed to write the file: ${err}\x1b[0m\n`);
        }
    });
}

function watchAppBundleChanges() { // Watch the compiled test app bundle and mirror it into native platform assets.
    console.log(`Watching for changes in ${paths.appBundle.source}...`);

    fs.watchFile(paths.appBundle.source, { interval: 500 }, (curr, prev) => {
        try {
            console.log(`\n\x1b[34mLoading ${paths.appBundle.file} content and copying it to Cordova platform assets...\x1b[0m`);
            for (const destinationPath of paths.appBundle.destinations) { // Mirror the compiled app bundle into both generated platforms.
                fs.copyFileSync(paths.appBundle.source, destinationPath)
            }
            console.log(`\x1b[32mCompiled app js copied successfully to the Cordova app.\x1b[0m\n`);
        } catch (err) {
            console.error(`\x1b[31mFailed to write the file: ${err}\x1b[0m\n`);
        }
    });
}
