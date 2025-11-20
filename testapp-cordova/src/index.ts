
import { zipIDcard, zipDLcard, serverCredentials } from "./demodata"
import "cordova-powerauth-mobile-sdk"
import { WDOActivationService, WDODocumentFile, WDODocumentSide, WDODocumentType, WDOScannedDocument, WDOVerificationService, WDOVerificationState, WDOVerificationStateType } from "cordova-digital-onboarding"
import { WPNLoggerConfig, WPNLoggerVerbosity } from "cordova-powerauth-networking";
import { IProov, IProovListener } from "iproov-cordova-plugin"

document.addEventListener('deviceready', onDeviceReady, false)

declare var  cordova: any;

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready')?.classList.add('ready');
    document.getElementById('btn-simulate')?.addEventListener('click', simulateActivation)
    const outputElem = document.getElementById('output') as HTMLTextAreaElement

    // Override console.log to also output to textarea
    const originalConsoleLog = console.log
    console.log = function(message?: any, ...optionalParams: any[]) {
        const now = new Date()
        const messageWithTime = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}] ${message}`
        outputElem.value += messageWithTime + ' ' + optionalParams.join(' ') + '\n'
        outputElem.scrollTop = outputElem.scrollHeight
        originalConsoleLog.apply(console, [messageWithTime, ...optionalParams])
    }
}

async function simulateActivation() {

    const pin = "1234"
    const powerAuth = new PowerAuth(generateRandomNumericString());
    powerAuth.configure({
        configuration: serverCredentials.paConfig,
        baseEndpointUrl: `${serverCredentials.server}/enrollment-server/`
    });
    
    const activationService = new WDOActivationService(
        powerAuth,
        `${serverCredentials.server}/enrollment-server-onboarding/`
    )

    const verificationService = new WDOVerificationService(
        powerAuth, 
        `${serverCredentials.server}/enrollment-server-onboarding/`
    )

    function getRandomAttributes(): any {
        return {
            clientNumber: generateRandomNumericString(),
            birthDate: "1990/03/04"
        }
    }

    try {

        //WPNLoggerConfig.verbosity = WPNLoggerVerbosity.DEBUG

        // FIRST ACTIVATION PROCESS WITH CANCEL

        console.log("Starting onboarding process...")
        await activationService.start(getRandomAttributes())
        console.log(`Activation started:  ${activationService.hasActiveProcess ? "yes" : "no"}`)

        console.log("Getting activation status...")
        const status = await activationService.status()
        console.log(`Activation status after start: ${status}`)
        
        // console.log("Resending OTP...")
        // await activationService.resendOTP()
        // console.log("OTP resent.")

        // TODO: retrieve OTP from server or user input

        console.log("Cancelling activation...")
        await activationService.cancel(false)
        console.log("Activation process canceled.")

        console.log(`Activation started:  ${activationService.hasActiveProcess ? "yes" : "no"}`)

        // SECOND ACTIVATION PROCESS WITHOUT CANCEL

        // start onboarding
        console.log("Starting second onboarding process...")
        await activationService.start(getRandomAttributes())
        console.log(`Activation started:  ${activationService.hasActiveProcess ? "yes" : "no"}`)

        // get onboarding status
        console.log("Getting activation status...")
        const status2 = await activationService.status()
        console.log(`Activation status after start: ${status2}`)

        // retrieve OTP from server (in real app, user would input it)
        console.log("Retrieving OTP from server...")
        const anyActivationService: any = activationService // to access non-public method
        const otp: string = await anyActivationService.getOTP()
        console.log(`OTP retrieved: ${otp}`)

        // activate PowerAuth SDK
        console.log("Activating PowerAuth SDK...")
        const activationResult = await activationService.activate("my-test-activation", otp)
        console.log(`PowerAuth SDK activated. Activation fingerprint: ${activationResult.activationFingerprint}`);

        // persist activation
        await powerAuth.persistActivation(PowerAuthAuthentication.persistWithPassword(pin))
        console.log("PowerAuth SDK activation persisted with password.");

        // fetch activation status to verify it's active
        console.log("Fetching PowerAuth SDK activation status...")
        const paStatus = await powerAuth.fetchActivationStatus()
        console.log(`PowerAuth SDK activation status: ${JSON.stringify(paStatus)}`);
        if (paStatus.state !== PowerAuthActivationState.ACTIVE) {
            throw new Error("PowerAuth SDK is not active after activation!")
        }

        const flags = paStatus.customObject?.activationFlags as Array<string> | undefined
        console.log(`PowerAuth SDK activation flags: ${flags ? flags.join(", ") : "none"}`)
        if (!flags || !flags.some(f => f === "VERIFICATION_PENDING")) {
            throw new Error("PowerAuth SDK activation flags do not contain VERIFICATION_PENDING after onboarding activation!")
        }

        const isVerificationRequired = WDOVerificationService.isVerificationRequired(paStatus)
        console.log(`Is verification required: ${isVerificationRequired ? "yes" : "no"}`)
        if (!isVerificationRequired) {
            throw new Error("Verification is not required according to WDOVerificationService after onboarding activation!")
        }

        // VERIFICATION STARTS HERE

        // get verification status
        console.log("Retrieving verification status...")
        const vfStatus = await verificationService.status()
        console.log(`Onboarding verification status: ${vfStatus.type}`);
        guardState(vfStatus.type, WDOVerificationStateType.intro)

        // get consent text
        console.log("Retrieving consent text...")
        const consentTextResponse = await verificationService.consentGet()
        guardState(consentTextResponse.type, WDOVerificationStateType.consent)
        if (consentTextResponse.type == WDOVerificationStateType.consent) {
            console.log(`Consent text retrieved: ${(consentTextResponse).body.substring(0, 50)}...`)
        }

        // approve consent
        console.log("Approving consent...")
        const approvalResult = await verificationService.consentApprove()
        guardState(approvalResult.type, WDOVerificationStateType.documentsToScanSelect)
        console.log("Consent approved.")

        // init document scanning SDK
        console.log("Initializing document scanning SDK...")
        const initResult = await verificationService.documentsInitSDK()
        console.log(`Document scanning SDK initialized: ${JSON.stringify(initResult)}`)

        // set selected document types
        console.log("Setting selected document types...")
        const docTypesResult = await verificationService.documentsSetSelectedTypes([
            WDODocumentType.idCard,
            WDODocumentType.driversLicense
        ])
        guardState(docTypesResult.type, WDOVerificationStateType.scanDocument)
        console.log("Selected document types set.")
        if (docTypesResult.type == WDOVerificationStateType.scanDocument) {
            console.log(`Documents to scan: ${JSON.stringify(docTypesResult.process.documents)}`)
        }

        const scannedId = [
            new WDODocumentFile("fakedata", WDODocumentType.idCard, WDODocumentSide.front),
            new WDODocumentFile("fakedata", WDODocumentType.idCard, WDODocumentSide.back),
        ]

        const scannedDL = [
            new WDODocumentFile("fakedata", WDODocumentType.driversLicense, WDODocumentSide.front)
        ]

        // simulate document scanning by submitting demo ZIP file
        console.log("Demo ID card scan")
        const demoResultIdcard = await uploadDocuments(verificationService, scannedId, zipIDcard)
        console.log(`Verification status after ID card scan: ${demoResultIdcard.type}`)
        guardState(demoResultIdcard.type, WDOVerificationStateType.scanDocument)

        // simulate document scanning by submitting demo ZIP file
        console.log("Driving License card scan")
        const demoResultDLcard = await uploadDocuments(verificationService, scannedDL, zipDLcard)
        console.log(`Verification status after Driving License card scan: ${demoResultDLcard.type}`)
        guardState(demoResultDLcard.type, WDOVerificationStateType.presenceCheck)

        // init presence check
        console.log("Initializing presence check...")
        const presenceInitResult = await verificationService.presenceCheckInit()
        console.log(`Presence check result: ${JSON.stringify(presenceInitResult)}`)

        // Run iProov SDK
        console.log("Starting iProov presence check...")
        const iProovResult = await IProov.launch("wss://eu3.rp.secure.iproov.me/ws", presenceInitResult.iProovVerificationToken, null, (event) => {
            console.log(`iProov event: ${event.name}`)
        })
        console.log(`iProov presence check completed with result: ${JSON.stringify(iProovResult)}`)

        // submit presence check result
        console.log("Submitting presence check result...")
        await verificationService.presenceCheckSubmit()
        console.log(`Verification status after presence check submitted.`)

        // wait for another status
        const afterPresenceCheckStatus = await waitForStatusChange(verificationService)
        console.log(`Verification status after presence check processing: ${afterPresenceCheckStatus.type}`)
        guardState(afterPresenceCheckStatus.type, WDOVerificationStateType.otp)

        // retrieve OTP from server (in real app, user would input it)
        console.log("Retrieving OTP from server for verification...")
        const anyVerificationService: any = verificationService // to access non-public method
        const otpVerification: string = await anyVerificationService.getOTP()
        console.log(`OTP retrieved for verification: ${otpVerification}`)

        // submit OTP
        console.log("Submitting OTP for verification...")
        const otpStatus = await verificationService.verifyOTP(otpVerification)
        console.log(`Status after OTP submission: ${otpStatus.type}`)

        // wait for final status
        const finalStatus = await waitForStatusChange(verificationService)
        console.log(`Verification status after presence check processing: ${finalStatus.type}`)
        guardState(finalStatus.type, WDOVerificationStateType.success)

        console.log("Onboarding process completed successfully.")

        console.log("Fetching PowerAuth SDK activation status...")
        const finalPaStatus = await powerAuth.fetchActivationStatus()
        console.log(`PowerAuth SDK activation status: ${JSON.stringify(finalPaStatus)}`);

    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error during activation: ${error.message}`);
        } else {
            console.error(`Error during activation: ${JSON.stringify(error)}`);
        }
    } finally {

        // REMOVING POWERAUTH SDK ACTIVATION

        console.log("Removing PowerAuth SDK activation...")
        await powerAuth.removeActivationWithAuthentication(PowerAuthAuthentication.password(pin))
        console.log("PowerAuth SDK activation removed.");
    }
}

async function uploadDocuments(verificationService: WDOVerificationService, documents: WDODocumentFile[], zip: { folder: string, data: string }): Promise<WDOVerificationState> {
    // simulate document scanning by submitting demo ZIP file
    console.log("Simulating document scanning by submitting demo ZIP file...")
    const scanResult = await verificationService.documentsSubmit(
        documents,
        zip.folder,
        zip.data
    )
    guardState(scanResult.type, WDOVerificationStateType.processing)
    console.log("Demo document scans submitted, fetching status.")

    return await waitForStatusChange(verificationService)
}

async function waitForStatusChange(verificationService: WDOVerificationService): Promise<WDOVerificationState> {
    
    let repeatedStatus = await verificationService.status()

    console.log(`Initial status verification: ${repeatedStatus.type}`)

    while(repeatedStatus.type === WDOVerificationStateType.processing) {
        console.log(`Verification still processing (${repeatedStatus.item}), waiting 3 seconds before next status check...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
       
        repeatedStatus = await verificationService.status()
    }

    return repeatedStatus
}

function guardState(state: WDOVerificationStateType, expected: WDOVerificationStateType) {
    if (state !== expected) {
        throw new Error(`Invalid verification state. Expected: ${expected}, actual: ${state}`)
    } else {
        console.log(`Verification state is as expected: ${state}`)
    }
}

function generateRandomNumericString(length: number = 10): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}
