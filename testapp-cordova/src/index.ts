
import { serverCredentials, blinkIdIos, blinkIdAndroid } from "./demodata"
import "cordova-powerauth-mobile-sdk"
import { WDOActivationService, WDODocumentFile, WDODocumentSide, WDODocumentType, 
    WDOVerificationService, WDOVerificationState, WDOVerificationStateType, WDOConfigurationService, 
    WDOLogger, WDOLogLevel, WDOConfigurationResponse, WDOConfigurationDocument,
    WDOIntroState, WDOConsentResponse, WDOError } from "cordova-digital-onboarding"
import "cordova-powerauth-networking"
import { IProov } from "iproov-cordova-plugin"
import { BlinkID, BlinkIdScanningSettings, BlinkIdScanningUxSettings, BlinkIdSdkSettings, BlinkIdSessionSettings, CroppedImageSettings } from "blinkid-cordova-plugin"
import { WPNLoggerConfig, WPNLoggerVerbosity } from "cordova-powerauth-networking"

document.addEventListener('deviceready', onDeviceReady, false)

declare var cordova: any

function onDeviceReady() {

    document.getElementById('deviceready')?.classList.add('ready')
    document.getElementById('btn-simulate')?.addEventListener('click', simulateActivation)
    const outputElem = document.getElementById('output') as HTMLTextAreaElement

    // SETUP LOGGING

    // WPNLoggerConfig.verbosity = WPNLoggerVerbosity.DEBUG
    WDOLogger.logLevel = WDOLogLevel.DEBUG
    const isInAppLoggerEnabled = true

    // Override console.log to also output to textarea
    const originalConsoleLog = console.log
    console.log = function(message?: any, ...optionalParams: any[]) {
        const now = new Date()
        const messageWithTime = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}] ${message}`
        if (isInAppLoggerEnabled) {
            outputElem.value += messageWithTime + ' ' + optionalParams.join(' ') + '\n'
            outputElem.scrollTop = outputElem.scrollHeight
        }
        originalConsoleLog.apply(console, [messageWithTime, ...optionalParams])
    }

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version)

    simulateActivation()
}

async function simulateActivation() {

    const pin = "1234"
    const powerAuth = new PowerAuth(generateRandomNumericString())
    powerAuth.configure({
        configuration: serverCredentials.paConfig,
        baseEndpointUrl: `${serverCredentials.server}/enrollment-server/`
    })

    const powerAuth2 = new PowerAuth(generateRandomNumericString())
    powerAuth2.configure({
        configuration: serverCredentials.paConfig,
        baseEndpointUrl: `${serverCredentials.server}/enrollment-server/`
    })
    
    let activationService = new WDOActivationService(
        powerAuth,
        `${serverCredentials.server}/enrollment-server-onboarding/`
    )

    let verificationService = new WDOVerificationService(
        powerAuth, 
        `${serverCredentials.server}/enrollment-server-onboarding/`
    )

    const configurationService = new WDOConfigurationService(
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

        // DEFAULT SETUP AND CONFIGURATION

        const processType: string | undefined = "onboarding" // undefined
        const defaultConfig: WDOConfigurationResponse = {
            enabled: true,
            otpForIdentification: true,
            otpForIdentityVerification: true,
            documents: {
                totalRequiredDocumentsCount: 1,
                groups: [
                    {
                        requiredDocumentsCount: 1,
                        items: [
                            {
                                type: "ID_CARD",
                                sideCount: 2
                            }
                        ]
                    }
                ],
            }
        }

        // FIRST TRY TO FETCH CONFIGURATION FROM THE SERVER
        let config: WDOConfigurationResponse

        if (processType) {
            console.log("Fetching configuration from the server...")
            config = await configurationService.getConfiguration(processType)
            console.log(`Configuration fetched: ${JSON.stringify(config)}`)
            if (!config.enabled) {
                throw new Error("Onboarding process is not enabled on the server!")
            }
            if (!config.documents || config.documents.groups.length === 0 || config.documents.groups[0].items.length === 0) {
                throw new Error("No documents configured for onboarding process on the server!")
            }
        } else {
            console.log("No process type specified, skipping configuration fetch.")
            config = defaultConfig
        }

        // PREPARE DOCUMENT TYPES FOR SCANNING BASED ON CONFIGURATION
        type DocumentTypeToScan = { type: WDODocumentType, sideCount: number }
        const documentTypesToScan: DocumentTypeToScan[] = []

        // first go-through to add mandatory documents from all groups
        for (const group of config.documents.groups) {
            for (let i = 0; i < group.requiredDocumentsCount; i++) {
                const docType = configDocToDocType(group.items[i])
                console.log(`Adding mandatory document from configuration group: ${docType.type}`)
                documentTypesToScan.push(docType)
            }
        }

        const hasRequiredDocCount = (documentTypesToScan: DocumentTypeToScan[]): boolean => { 
            return documentTypesToScan.length >= config.documents.totalRequiredDocumentsCount 
        }

        if (!hasRequiredDocCount(documentTypesToScan)) {
            // second go-through to add non-mandatory documents from all groups to fulfill required count
            for (const group of config.documents.groups) {
                
                if (hasRequiredDocCount(documentTypesToScan)) {
                    break
                }

                for (const item of group.items) {
                    const docType = configDocToDocType(item)
                    if (!documentTypesToScan.find(d => d.type === docType.type)) {
                        console.log(`Adding non-mandatory document from configuration group: ${docType.type}`)
                        documentTypesToScan.push(docType)
                        if (hasRequiredDocCount(documentTypesToScan)) {
                            break
                        }
                    }
                }
            }
        }

        console.log(`Final list of document types to scan: ${JSON.stringify(documentTypesToScan)}`)

        // FIRST ACTIVATION PROCESS WITH CANCEL

        console.log(`Starting onboarding process (process type: ${processType})...`)
        await activationService.start(getRandomAttributes(), processType)
        console.log(`Activation started:  ${await activationService.hasActiveProcess() ? "yes" : "no"}`)

        console.log("Getting activation status...")
        const status = await activationService.status()
        console.log(`Activation status after start: ${status}`)

        if (config.otpForIdentification) {
            console.log("Wrong OTP on purpose to test failure...")
            let thrownError = false
            try {
                await activationService.activate("my-test-activation", "wrong-otp")
                console.log("Activation should have failed with wrong OTP but it didn't.")
            } catch (error) {
                console.log(`Activation failed as expected with wrong OTP.`)
                if (error instanceof WDOError) {
                    console.log(`Remaining OTP attempts: ${error.onboardingOtpRemainingAttempts}`)
                    thrownError = error.allowOnboardingOtpRetry
                }
            }
            if (!thrownError) {
                throw new Error("Activation did not fail with wrong OTP as expected!")
            }
        }
        
        if (config.otpForIdentification) {
            console.log("Resending OTP...")
            await activationService.resendOTP()
            console.log("OTP resent.")
        } else {
            console.log("OTP for identification is not required, skipping resend.")
        }

        // now create new activation instance to verify that cached process is loaded correctly
        console.log("Creating new activation service instance to verify cached process...")
        activationService = new WDOActivationService(
            powerAuth, 
            `${serverCredentials.server}/enrollment-server-onboarding/`
        )

        const statusAfterChange = await activationService.status()
        console.log(`Activation status after new service instance: ${statusAfterChange}`)
        if (statusAfterChange !== status) {
            throw new Error("Activation status after creating new service instance does not match the previous status!")
        }

        console.log("Cancelling activation...")
        await activationService.cancel(false)
        console.log("Activation process canceled.")

        console.log(`Activation started:  ${await activationService.hasActiveProcess() ? "yes" : "no"}`)

        // SECOND ACTIVATION PROCESS WITHOUT CANCEL

        // start onboarding
        console.log(`Starting second onboarding process with onboarding type: ${processType}...`)
        await activationService.start(getRandomAttributes(), processType)
        console.log(`Activation started:  ${await activationService.hasActiveProcess() ? "yes" : "no"}`)

        // get onboarding status
        console.log("Getting activation status...")
        const status2 = await activationService.status()
        console.log(`Activation status after start: ${status2}`)

        let otpCode: string | undefined = undefined

        //retrieve OTP from server (in real app, user would input it)
        if (config.otpForIdentification) {
            console.log("Retrieving OTP from server...")
            const anyActivationService: any = activationService // to access non-public method
            otpCode = await anyActivationService.getOTP()
            console.log(`OTP retrieved: ${otpCode}`)

            // use wrong OTP to test failure

            try {
                await activationService.activate("my-test-activation", "wrong-otp")
                console.error("Activation should have failed with wrong OTP but it didn't.")
            } catch (error) {
                console.log(`Activation failed as expected with wrong OTP.`)
            }
        } else {
            console.log("OTP for identification is not required, skipping OTP retrieval.")
        }

        // activate PowerAuth SDK
        console.log("Activating PowerAuth SDK...")
        const activationResult = await activationService.activate("my-test-activation", otpCode)
        console.log(`PowerAuth SDK activated. Activation fingerprint: ${activationResult.activationFingerprint}`)

        // persist activation
        await powerAuth.persistActivation(PowerAuthAuthentication.persistWithPassword(pin))
        console.log("PowerAuth SDK activation persisted with password.")

        // fetch activation status to verify it's active
        console.log("Fetching PowerAuth SDK activation status...")
        const paStatus = await powerAuth.fetchActivationStatus()
        console.log(`PowerAuth SDK activation status: ${JSON.stringify(paStatus)}`)
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
        console.log(`Onboarding verification status: ${vfStatus.type}`)
        guardState(vfStatus.type, WDOVerificationStateType.intro)
        const introState = vfStatus as WDOIntroState

        // get consent text if required
        if (introState.consentRequired) {
            console.log("Retrieving consent text...")
            const consentTextResponse = await verificationService.consentGet()
            console.log(`Consent text retrieved: ${consentTextResponse.substring(0, 50)}...`)
        } else {
            console.log("Consent not required, skipping consent retrieval.")
        }

        if (introState.consentRequired) {
            // simulate disapproval of consent to test the flow
            console.log("Starting identification process (with consent declined)...")
            const disapprovResult = await verificationService.start(WDOConsentResponse.declined)
            guardState(disapprovResult.type, WDOVerificationStateType.intro)
            console.log("Identification process returned to intro state after consent declined.")
        }

        // start identification
        console.log(`Starting identification process ${introState.consentRequired ? "(with consent approved)" : "(consent not required)"}...`)
        const startResult = await verificationService.start(introState.consentRequired ? WDOConsentResponse.approved : WDOConsentResponse.notRequired)
        guardState(startResult.type, WDOVerificationStateType.documentsToScanSelect)
        console.log("Identification process started.")

        // init document scanning SDK
        console.log("Initializing document scanning SDK...")
        const initResult = await verificationService.documentsInitSDK()
        console.log(`Document scanning SDK initialized: ${JSON.stringify(initResult)}`)

        // set selected document types
        console.log(`Setting selected document types: ${JSON.stringify(documentTypesToScan)}`)
        const docTypesResult = await verificationService.documentsSetSelectedTypes(documentTypesToScan.map(d => d.type))
        guardState(docTypesResult.type, WDOVerificationStateType.scanDocument)
        console.log("Selected document types set.")
        if (docTypesResult.type == WDOVerificationStateType.scanDocument) {
            
            console.log(`Documents to scan: ${JSON.stringify(docTypesResult.process.documents)}`)

            // verify that all required document types are in the process
            console.log("Verifying that all required document types are in the scanning process...")
            const process = docTypesResult.process
            documentTypesToScan.forEach(docType => {
                if (!process.documents.find(d => d.type === docType.type)) {
                    throw new Error(`Document type ${docType.type} not found in scanning process!`)
                }
            })
        }

        // now create new verification instance to verify that cached process is loaded correctly
        console.log("Creating new verification service instance to verify cached scanning process...")
        verificationService = new WDOVerificationService(
            powerAuth, 
            `${serverCredentials.server}/enrollment-server-onboarding/`
        )

        // get verification status again
        console.log("Retrieving verification status from new service instance...")
        const statusWithCachedProcess = await verificationService.status()
        guardState(statusWithCachedProcess.type, WDOVerificationStateType.scanDocument)
        console.log("Verification status with cached process retrieved.")
        
        if (statusWithCachedProcess.type == WDOVerificationStateType.scanDocument) {
            
            console.log(`Documents to scan: ${JSON.stringify(statusWithCachedProcess.process.documents)}`)

            // verify that all required document types are in the process
            console.log("Verifying that all required document types are in the scanning process...")
            const process = statusWithCachedProcess.process
            documentTypesToScan.forEach(docType => {
                if (!process.documents.find(d => d.type === docType.type)) {
                    throw new Error(`Document type ${docType.type} not found in scanning process!`)
                }
            })
        }

        // retrieve license key for BlinkID
        const licenseKey = initResult.blinkIDKey
        console.log(`Retrieved BlinkID license key: ${licenseKey}`)
        console.log("Using hardcoded BlinkID iOS license key for testing...")

        // perform BlinkID scan for documents
        const sdkSettings = new BlinkIdSdkSettings(cordova.platformId == "ios" ? blinkIdIos : blinkIdAndroid)
        const sessionSettings = new BlinkIdSessionSettings()
        sessionSettings.scanningSettings = new BlinkIdScanningSettings()
        sessionSettings.scanningSettings.returnInputImages = true
        sessionSettings.scanningSettings.croppedImageSettings = new CroppedImageSettings()
        sessionSettings.scanningSettings.croppedImageSettings.returnDocumentImage = true
        const uxSettings = new BlinkIdScanningUxSettings()
        uxSettings.showHelpButton = false
        uxSettings.showOnboardingDialog = false

        let blinkIDUploadResult: WDOVerificationState = docTypesResult // initial value to please the compiler
        
        for (const doc of documentTypesToScan) {
            console.log(`Starting BlinkID scan for document type: ${doc.type}...`)
            const result = await BlinkID.performScan(sdkSettings, sessionSettings, uxSettings)
        
            const image1 = result.firstInputImage
            if (!image1) {
                throw { message: "No 1st side of document captured from BlinkID scan!" }
            }

            const imagesToUpload = [new WDODocumentFile(image1, doc.type, WDODocumentSide.front)]

            const image2 = result.secondInputImage
            if (!image2) {
                console.log("No 2nd side of document captured from BlinkID scan!")
                if (doc.sideCount > 1) {
                    throw { message: "2nd side of document required but not captured from BlinkID scan!" }
                }
            } else {
                console.log("2nd side of document captured from BlinkID scan.")
                imagesToUpload.push(new WDODocumentFile(image2, doc.type, WDODocumentSide.back))
            }

            blinkIDUploadResult = await uploadDocumentsFromBlinkId(verificationService, imagesToUpload)
            console.log(`Verification status after BlinkID ${doc.type} scan: ${blinkIDUploadResult.type}`)   
        }

        guardState(blinkIDUploadResult.type, WDOVerificationStateType.presenceCheck)

        // init presence check
        console.log("Initializing presence check...")
        const presenceInitResult = await verificationService.presenceCheckInit()
        console.log(`Presence check result: ${JSON.stringify(presenceInitResult)}`)

        // Run iProov SDK
        console.log("Starting iProov presence check...")
        const iProovResult = await IProov.launch("wss://eu3.rp.secure.iproov.me/ws", presenceInitResult.iProovVerificationToken!, null, (event) => {
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

        if (config.otpForIdentityVerification) {
            guardState(afterPresenceCheckStatus.type, WDOVerificationStateType.otp)

            // submit wrong OTP to test failure
            try {
                console.log("Submitting wrong OTP for verification...")
                const otpStatusWrong = await verificationService.verifyOTP("1234567")
                guardState(otpStatusWrong.type, WDOVerificationStateType.otp)
                const remainingAfterWrong = (otpStatusWrong as any).remainingAttempts as number
                if (remainingAfterWrong !== 4) {
                    throw new Error(`Remaining attempts after wrong OTP (${remainingAfterWrong})`)
                }
                console.log(`OTP failed as expected, remaining attempts: ${remainingAfterWrong}`)
            } catch (error) {
                console.log(`OTP should have not failed`)
                throw error
            }

            // retrieve OTP from server (in real app, user would input it)
            console.log("Retrieving OTP from server for verification...")
            const anyVerificationService: any = verificationService // to access non-public method
            const otpVerification: string = await anyVerificationService.getOTP()
            console.log(`OTP retrieved for verification: ${otpVerification}`)

            // submit OTP
            console.log("Submitting OTP for verification...")
            const otpStatus = await verificationService.verifyOTP(otpVerification)
            console.log(`Status after OTP submission: ${otpStatus.type}`)
        } else {
            console.log("OTP for identity verification is not required, skipping OTP retrieval and submission.")
        }

        // wait for another status
        let anotherStatus = await waitForStatusChange(verificationService)
        console.log(`Verification status after presence check/otp processing: ${anotherStatus.type}`)

        // lets check if we need to finish activation
        if (anotherStatus.type === WDOVerificationStateType.finishActivation) {

            // verify that PowerAuth 2 instance has no activation yet
            if (await powerAuth2.hasValidActivation()) {
                throw new Error("PowerAuth2 instance already has an active activation before finishActivation!")
            }

            // finish activation
            console.log("Finishing activation...")
            anotherStatus = await verificationService.finishActivation(
                powerAuth2,
                "onboarding-activation",
                await PowerAuthPassword.fromString(pin, false),
                true
            )
            // on success, the state should be success
            guardState(anotherStatus.type, WDOVerificationStateType.success)
            console.log(`Verification status after activation finished is : ${anotherStatus.type}`)

            // powerauth now should have active activation
            if (await powerAuth2.hasValidActivation()) {
                console.log("PowerAuth2 instance has valid activation after finishActivation.")
            } else {
                throw new Error("PowerAuth2 instance does not have a valid activation after finishActivation!")
            }

            // verify that activation is active
            const pa2Status = await powerAuth2.fetchActivationStatus()
            console.log(`PowerAuth2 SDK activation status: ${JSON.stringify(pa2Status)}`)
            if (pa2Status.state == PowerAuthActivationState.ACTIVE) {
                console.log("PowerAuth2 instance activation is active after finishActivation.")
            } else {
                throw new Error(`PowerAuth2 instance activation is not active after finishActivation: ${pa2Status.state}`)
            }

            const removedStatus = await powerAuth.fetchActivationStatus()
            console.log(`Fetched original PA status after finishActivation: ${JSON.stringify(removedStatus)}`)
            if (removedStatus.state == PowerAuthActivationState.REMOVED) {
                console.log("Original PowerAuth instance activation is removed after finishActivation.")
            } else {
                throw new Error(`Original PowerAuth instance activation is not removed after finishActivation: ${removedStatus.state}`)
            }

        } else {
            guardState(anotherStatus.type, WDOVerificationStateType.success)
            console.log("Onboarding process completed successfully.")

            console.log("Fetching PowerAuth SDK activation status...")
            const finalPaStatus = await powerAuth.fetchActivationStatus()
            console.log(`PowerAuth SDK activation status: ${JSON.stringify(finalPaStatus)}`)
        }

    } catch (error) {
        console.log(`Error during activation:`)
        console.log(`  - message: ${(error as any)?.message}`)
        console.log(`  - object: ${JSON.stringify(error)}`)
    } finally {

        // REMOVING POWERAUTH SDK ACTIVATION

        console.log("Removing PowerAuth SDK activation...")
        await powerAuth.removeActivationWithAuthentication(PowerAuthAuthentication.password(pin))
        console.log("PowerAuth SDK activation removed.")
    }
}

async function uploadDocumentsFromBlinkId(verificationService: WDOVerificationService, documents: WDODocumentFile[]): Promise<WDOVerificationState> {
    console.log("Simulating document scanning by submitting blinkID images...")
    const scanResult = await verificationService.documentsSubmit(
        documents
    )
    guardState(scanResult.type, WDOVerificationStateType.processing)
    console.log("Demo document scans submitted, fetching status.")

    return await waitForStatusChange(verificationService)
}

async function waitForStatusChange(verificationService: WDOVerificationService): Promise<WDOVerificationState> {
    
    let repeatedStatus = await verificationService.status()

    console.log(`Waiting until processing ends (if in progress): ${repeatedStatus.type}`)

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
    let result = ''
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString()
    }
    return result
}


function configDocToDocType(doc: WDOConfigurationDocument): { type: WDODocumentType, sideCount: number } {
    if (doc.type === "DRIVER_LICENSE") {
        return { type: WDODocumentType.driversLicense, sideCount: doc.sideCount }
    } else if (doc.type === "ID_CARD") {
        return { type: WDODocumentType.idCard, sideCount: doc.sideCount }
    } else if (doc.type === "PASSPORT") {
        return { type: WDODocumentType.passport, sideCount: doc.sideCount }
    } else {
        throw new Error(`Unsupported document type in configuration: ${doc.type}`)
    }
}
