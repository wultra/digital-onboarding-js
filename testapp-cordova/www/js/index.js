'use strict';

document.addEventListener('deviceready', onDeviceReady, false);
function onDeviceReady() {
    // Cordova is now initialized. Have fun!
    var _a;
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    (_a = document.getElementById('deviceready')) === null || _a === void 0 ? void 0 : _a.classList.add('ready');
    console.log("".concat(WPNNetworking.name));
    console.log("".concat(PowerAuth.name));
    console.log("".concat(WDOActivationService.name));
}
//# sourceMappingURL=index.js.map
