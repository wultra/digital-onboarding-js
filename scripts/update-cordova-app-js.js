import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// This script watches for changes in the built app.js file in lib-cordova package
// and copies it into the Cordova app's www/plugins/cordova-digital-onboarding directory,
// wrapping it in a Cordova define call so that it can be properly loaded by Cordova.
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

console.log(`Watching for changes in ${filePath}...`);

// Use fs.watchFile to monitor changes in the file (500ms interval)
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

// Use fs.watchFile to monitor changes in the file (500ms interval)
fs.watchFile(appFilePath, { interval: 500 }, (curr, prev) => {
    
    try {
        console.log(`\n\x1b[34mLoading ${appOutputFile} content and wrapping it in a Cordova define...\x1b[0m`);
        // Copy the file to the destination file (iOS platform)
        fs.copyFileSync(appFilePath, appDestIos)
        fs.copyFileSync(appFilePath, appDestAndroid)
        console.log(`\x1b[32mCompiled app js copied successfully to the Cordova app.\x1b[0m\n`);
    } catch (err) {
        console.error(`\x1b[31mFailed to write the file: ${err}\x1b[0m\n`);
    }
}); 