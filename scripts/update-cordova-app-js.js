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

const moduleName = 'cordova-digital-onboarding.WultraDigitalOnboarding';
const outputFile = 'lib/index.js';
const filePath = path.resolve(__dirname, `../packages/lib-cordova/${outputFile}`);
const destIos1 = path.resolve(__dirname, `../testapp-cordova/platforms/ios/www/plugins/cordova-digital-onboarding/${outputFile}`);
const destIos2 = path.resolve(__dirname, `../testapp-cordova/platforms/ios/platform_www/plugins/cordova-digital-onboarding/${outputFile}`);
const androidDest1 = path.resolve(__dirname, `../testapp-cordova/platforms/android/app/src/main/assets/www/plugins/cordova-digital-onboarding/${outputFile}`);
const androidDest2 = path.resolve(__dirname, `../testapp-cordova/platforms/android/platform_www/plugins/cordova-digital-onboarding/${outputFile}`);
// Files in patchfiles mirror the structure under testapp-cordova and are copied over on startup.
const patchFilesRoot = path.resolve(__dirname, '../testapp-cordova/patchfiles');
const patchTargetRoot = path.resolve(__dirname, '../testapp-cordova');

// Apply platform overrides once when the script starts (for example modified CDVWebViewEngine.m to disable CORS in iOS App). 
applyPatchFiles();

console.log(`Watching for changes in ${filePath}...`);

// Keep the plugin bundle in sync inside already-generated Cordova platform folders.
fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
    
    try {
        console.log(`\n\x1b[34mLoading ${outputFile} content and wrapping it in a Cordova define...\x1b[0m`);
        // Read the content of the file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        // Wrap the content in a Cordova define
        const newContent = `cordova.define("${moduleName}", function(require, exports, module) {\n${fileContent}\n});\n`;
        // Write the new content to the destination files (iOS platform)
        fs.writeFileSync(destIos1, newContent, 'utf8');
        fs.writeFileSync(destIos2, newContent, 'utf8');
        fs.writeFileSync(androidDest1, newContent, 'utf8');
        fs.writeFileSync(androidDest2, newContent, 'utf8');
        console.log(`\x1b[32mLib js file copied successfully to the Cordova app.\x1b[0m\n`);
    } catch (err) {
        console.error(`\x1b[31mFailed to write the file: ${err}\x1b[0m\n`);
    }
}); 

const appOutputFile = 'www/js/index.js';
const appFilePath = path.resolve(__dirname, `../testapp-cordova/${appOutputFile}`);
const appDestIos = path.resolve(__dirname, `../testapp-cordova/platforms/ios/${appOutputFile}`);
const appDestAndroid = path.resolve(__dirname, `../testapp-cordova/platforms/android/app/src/main/assets/${appOutputFile}`);

console.log(`Watching for changes in ${appFilePath}...`);

// Keep the compiled test app entrypoint mirrored into native platform assets.
fs.watchFile(appFilePath, { interval: 500 }, (curr, prev) => {
    
    try {
        console.log(`\n\x1b[34mLoading ${appOutputFile} content and copying it to Cordova platform assets...\x1b[0m`);
        // Copy the file to the destination file (iOS platform)
        fs.copyFileSync(appFilePath, appDestIos)
        fs.copyFileSync(appFilePath, appDestAndroid)
        console.log(`\x1b[32mCompiled app js copied successfully to the Cordova app.\x1b[0m\n`);
    } catch (err) {
        console.error(`\x1b[31mFailed to write the file: ${err}\x1b[0m\n`);
    }
}); 

function applyPatchFiles() {
    // Collect every file from patchfiles so the same relative path can be copied into testapp-cordova.
    function getFilesRecursively(directory) {
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

    if (!fs.existsSync(patchFilesRoot)) {
        console.log(`\x1b[33mPatchfiles directory not found, skipping patch merge.\x1b[0m`);
        return;
    }

    const patchFiles = getFilesRecursively(patchFilesRoot);

    if (patchFiles.length === 0) {
        console.log(`\x1b[33mNo patch files found in ${patchFilesRoot}, skipping patch merge.\x1b[0m`);
        return;
    }

    console.log(`\n\x1b[34mApplying patch files from ${patchFilesRoot}...\x1b[0m`);

    for (const patchFile of patchFiles) {
        const relativePath = path.relative(patchFilesRoot, patchFile);
        const destinationPath = path.resolve(patchTargetRoot, relativePath);
        const action = fs.existsSync(destinationPath) ? 'Replaced' : 'Added';

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(patchFile, destinationPath);

        console.log(`\x1b[32m${action}: ${relativePath}\x1b[0m`);
    }

    console.log(`\x1b[32mPatch file merge completed.\x1b[0m\n`);
}
