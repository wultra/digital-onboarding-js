'use strict';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

document.addEventListener('deviceready', onDeviceReady, false);
function onDeviceReady() {
    // Cordova is now initialized. Have fun!
    var _a, _b;
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    (_a = document.getElementById('deviceready')) === null || _a === void 0 ? void 0 : _a.classList.add('ready');
    (_b = document.getElementById('btn-simulate')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', simulateActivation);
}
function simulateActivation() {
    return __awaiter(this, void 0, void 0, function () {
        function getRandomAttributes() {
            return {
                clientNumber: generateRandomNumericString(),
                birthDate: "1990/03/04"
            };
        }
        var serverCredentials, pin, powerAuth, activationService, verificationService, status_1, status2, anyActivationService, otp, activationResult, paStatus, vfStatus, consentTextResponse, approvalResult, initResult, docTypesResult, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    serverCredentials = {
                        server: "https://powerauth-dev.westeurope.cloudapp.azure.com",
                        paConfig: "ARCB+/qxpmLCa04AyT2IPXHKED4Heu76QU+v2PtnzQbe0sYBAUEEU05t3byEUdh90CBiBvqgr4sWU7r1YTAtdpTh3EyhAUL791k66wy+SZM1qELw6zdoOHNFk/z4neDDqKtIQ5E5jg==",
                    };
                    pin = "1234";
                    powerAuth = new PowerAuth(generateRandomNumericString());
                    powerAuth.configure({
                        configuration: serverCredentials.paConfig,
                        baseEndpointUrl: "".concat(serverCredentials.server, "/enrollment-server/")
                    });
                    activationService = new WDOActivationService(powerAuth, "".concat(serverCredentials.server, "/enrollment-server-onboarding/"));
                    verificationService = new WDOVerificationService(powerAuth, "".concat(serverCredentials.server, "/enrollment-server-onboarding/"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 16, 17, 19]);
                    // FIRST ACTIVATION PROCESS WITH CANCEL
                    console.log("Starting onboarding process...");
                    return [4 /*yield*/, activationService.start(getRandomAttributes())];
                case 2:
                    _a.sent();
                    console.log("Activation started:  ".concat(activationService.hasActiveProcess ? "yes" : "no"));
                    console.log("Getting activation status...");
                    return [4 /*yield*/, activationService.status()];
                case 3:
                    status_1 = _a.sent();
                    console.log("Activation status after start: ".concat(status_1));
                    // console.log("Resending OTP...")
                    // await activationService.resendOTP()
                    // console.log("OTP resent.")
                    // TODO: retrieve OTP from server or user input
                    console.log("Cancelling activation...");
                    return [4 /*yield*/, activationService.cancel(false)];
                case 4:
                    _a.sent();
                    console.log("Activation process canceled.");
                    console.log("Activation started:  ".concat(activationService.hasActiveProcess ? "yes" : "no"));
                    // SECOND ACTIVATION PROCESS WITHOUT CANCEL
                    // start onboarding
                    console.log("Starting second onboarding process...");
                    return [4 /*yield*/, activationService.start(getRandomAttributes())];
                case 5:
                    _a.sent();
                    console.log("Activation started:  ".concat(activationService.hasActiveProcess ? "yes" : "no"));
                    // get onboarding status
                    console.log("Getting activation status...");
                    return [4 /*yield*/, activationService.status()];
                case 6:
                    status2 = _a.sent();
                    console.log("Activation status after start: ".concat(status2));
                    // retrieve OTP from server (in real app, user would input it)
                    console.log("Retrieving OTP from server...");
                    anyActivationService = activationService // to access non-public method
                    ;
                    return [4 /*yield*/, anyActivationService.getOTP()];
                case 7:
                    otp = _a.sent();
                    console.log("OTP retrieved: ".concat(otp));
                    // activate PowerAuth SDK
                    console.log("Activating PowerAuth SDK...");
                    return [4 /*yield*/, activationService.activate(otp, "my-test-activation")];
                case 8:
                    activationResult = _a.sent();
                    console.log("PowerAuth SDK activated. Activation fingerprint: ".concat(activationResult.activationFingerprint));
                    // persist activation
                    return [4 /*yield*/, powerAuth.persistActivation(PowerAuthAuthentication.persistWithPassword(pin))];
                case 9:
                    // persist activation
                    _a.sent();
                    console.log("PowerAuth SDK activation persisted with password.");
                    // fetch activation status to verify it's active
                    console.log("Fetching PowerAuth SDK activation status...");
                    return [4 /*yield*/, powerAuth.fetchActivationStatus()];
                case 10:
                    paStatus = _a.sent();
                    console.log("PowerAuth SDK activation status: ".concat(paStatus.state));
                    if (paStatus.state !== PowerAuthActivationState.ACTIVE) {
                        throw new Error("PowerAuth SDK is not active after activation!");
                    }
                    // VERIFICATION STARTS HERE
                    // get verification status
                    console.log("Retrieving verification status...");
                    return [4 /*yield*/, verificationService.status()];
                case 11:
                    vfStatus = _a.sent();
                    console.log("Onboarding verification status: ".concat(vfStatus.type));
                    guardState(vfStatus.type, WDOVerificationStateType.intro);
                    // get consent text
                    console.log("Retrieving consent text...");
                    return [4 /*yield*/, verificationService.consentGet()];
                case 12:
                    consentTextResponse = _a.sent();
                    guardState(consentTextResponse.type, WDOVerificationStateType.consent);
                    if (consentTextResponse.type == WDOVerificationStateType.consent) {
                        console.log("Consent text retrieved: ".concat((consentTextResponse).body.substring(0, 50), "..."));
                    }
                    // approve consent
                    console.log("Approving consent...");
                    return [4 /*yield*/, verificationService.consentApprove()];
                case 13:
                    approvalResult = _a.sent();
                    guardState(approvalResult.type, WDOVerificationStateType.documentsToScanSelect);
                    console.log("Consent approved.");
                    // init document scanning SDK
                    console.log("Initializing document scanning SDK...");
                    return [4 /*yield*/, verificationService.documentsInitSDK()];
                case 14:
                    initResult = _a.sent();
                    console.log("Document scanning SDK initialized: ".concat(JSON.stringify(initResult)));
                    // set selected document types
                    console.log("Setting selected document types...");
                    return [4 /*yield*/, verificationService.documentsSetSelectedTypes([
                            WDODocumentType.idCard,
                            WDODocumentType.driversLicense
                        ])];
                case 15:
                    docTypesResult = _a.sent();
                    guardState(docTypesResult.type, WDOVerificationStateType.scanDocument);
                    console.log("Selected document types set.");
                    if (docTypesResult.type == WDOVerificationStateType.scanDocument) {
                        console.log("Documents to scan: ".concat(JSON.stringify(docTypesResult.process.documents)));
                    }
                    return [3 /*break*/, 19];
                case 16:
                    error_1 = _a.sent();
                    console.error("Error during activation", error_1);
                    return [3 /*break*/, 19];
                case 17:
                    // REMOVING POWERAUTH SDK ACTIVATION
                    console.log("Removing PowerAuth SDK activation...");
                    return [4 /*yield*/, powerAuth.removeActivationWithAuthentication(PowerAuthAuthentication.password(pin))];
                case 18:
                    _a.sent();
                    console.log("PowerAuth SDK activation removed.");
                    return [7 /*endfinally*/];
                case 19: return [2 /*return*/];
            }
        });
    });
}
function guardState(state, expected) {
    if (state !== expected) {
        throw new Error("Invalid verification state. Expected: ".concat(expected, ", actual: ").concat(state));
    }
    else {
        console.log("Verification state is as expected: ".concat(state));
    }
}
function generateRandomNumericString(length) {
    if (length === void 0) { length = 10; }
    var result = '';
    for (var i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}
//# sourceMappingURL=index.js.map
