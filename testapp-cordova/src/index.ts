
import "cordova-powerauth-mobile-sdk"
import { WDOActivationService, WDODocumentType, WDOVerificationService, WDOVerificationStateType } from "cordova-digital-onboarding"

document.addEventListener('deviceready', onDeviceReady, false)

declare var  cordova: any;

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready')?.classList.add('ready');
    document.getElementById('btn-simulate')?.addEventListener('click', simulateActivation)
}

async function simulateActivation() {

    const serverCredentials = {
        server: "https://localhost",
        paConfig: "base64-encoded-powerauth-configuration-string",
    }

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
        const activationResult = await activationService.activate(otp, "my-test-activation")
        console.log(`PowerAuth SDK activated. Activation fingerprint: ${activationResult.activationFingerprint}`);

        // persist activation
        await powerAuth.persistActivation(PowerAuthAuthentication.persistWithPassword(pin))
        console.log("PowerAuth SDK activation persisted with password.");

        // fetch activation status to verify it's active
        console.log("Fetching PowerAuth SDK activation status...")
        const paStatus = await powerAuth.fetchActivationStatus()
        console.log(`PowerAuth SDK activation status: ${paStatus.state}`);
        if (paStatus.state !== PowerAuthActivationState.ACTIVE) {
            throw new Error("PowerAuth SDK is not active after activation!")
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

    } catch (error) {
        console.error(`Error during activation`, error);
    } finally {

        // REMOVING POWERAUTH SDK ACTIVATION

        console.log("Removing PowerAuth SDK activation...")
        await powerAuth.removeActivationWithAuthentication(PowerAuthAuthentication.password(pin))
        console.log("PowerAuth SDK activation removed.");
    }

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
