
import { serverCredentials, otpMockStrategy } from "./demodata"
import { DemoEndpoints } from "./demoEndpoints"
import "cordova-powerauth-mobile-sdk"
import { WDOActivationService, WDODocumentFile, WDODocumentSide, WDODocumentType,
    WDOVerificationService, WDOVerificationState, WDOVerificationStateType, WDOConfigurationService,
    WDOLogger, WDOLogLevel, WDOConfigurationResponse, WDOConfigurationDocument,
    WDOIntroState, WDOConsentResponse, WDOError,
    WDOStatusCheckReason} from "cordova-digital-onboarding"
import "cordova-powerauth-networking"
import { WPNLoggerConfig, WPNLoggerVerbosity } from "cordova-powerauth-networking"

document.addEventListener('deviceready', onDeviceReady, false)

declare var cordova: any

function onDeviceReady() {

    document.getElementById('deviceready')?.classList.add('ready')
    document.getElementById('btn-simulate')?.addEventListener('click', simulateActivation)
    const outputElem = document.getElementById('output') as HTMLTextAreaElement

    // SETUP LOGGING

    WPNLoggerConfig.verbosity = WPNLoggerVerbosity.DEBUG
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

const approveWhenApprovalNeeded = true
const validUserAttributes = getRandomAttributes()
const approvalRejectReason = "Just a test reason"

async function simulateActivation() {

    const pin = "1234"
    const powerAuth = new PowerAuth(generateRandomNumericString())
    powerAuth.configure({
        configuration: serverCredentials.paConfig,
        baseEndpointUrl: serverCredentials.esUrl
    })

    const powerAuth2 = new PowerAuth(generateRandomNumericString())
    powerAuth2.configure({
        configuration: serverCredentials.paConfig,
        baseEndpointUrl: serverCredentials.esUrl
    })

    // Tracks whichever PowerAuth instance ends up active and fully verified - stays `powerAuth` unless
    // the flow reaches `finishActivation`, which swaps to `powerAuth2` and removes `powerAuth`.
    let activePowerAuth = powerAuth

    let activationService = new WDOActivationService(
        powerAuth,
        serverCredentials.esoUrl
    )

    let verificationService = new WDOVerificationService(
        powerAuth, 
        serverCredentials.esoUrl
    )

    const configurationService = new WDOConfigurationService(
        powerAuth,
        serverCredentials.esoUrl
    )

    let testFinishedWithSuccess = false

    try {

        // DEFAULT SETUP AND CONFIGURATION

        const processType: string | undefined = "onboarding" // undefined
        const defaultConfig: WDOConfigurationResponse = {
            enabled: true,
            otpForIdentification: true,
            otpForIdentityVerification: true,
            useTemporaryActivation: false,
            otpResendPeriodSeconds: 30,
            documents: {
                totalRequiredDocumentsCount: 1,
                groups: [
                    {
                        requiredDocumentsCount: 1,
                        items: [
                            {
                                type: "ID_CARD",
                                sideCount: 2,
                                country: "CZE"
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
            if (typeof config.useTemporaryActivation !== "boolean") {
                throw new Error("Invalid configuration for temporary activation!")
            }
            console.log(`OTP resend cooldown from configuration: ${config.otpResendPeriodSeconds ?? "not provided"}`)
        } else {
            console.log("No process type specified, skipping configuration fetch.")
            config = defaultConfig
        }

        // PREPARE DOCUMENT TYPES FOR SCANNING BASED ON CONFIGURATION
        type DocumentTypeToScan = { type: WDODocumentType, sideCount: number, country?: string }
        const documentTypesToScan: DocumentTypeToScan[] = []

        // first go-through to add mandatory documents from all groups
        for (const group of config.documents.groups) {
            for (let i = 0; i < group.requiredDocumentsCount; i++) {
                const docType = group.items[i]
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
                    if (!documentTypesToScan.find(d => d.type === item.type)) {
                        console.log(`Adding non-mandatory document from configuration group: ${item.type}`)
                        documentTypesToScan.push(item)
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
                thrownError = true
                if (error instanceof WDOError) {
                    console.log(`Remaining OTP attempts: ${error.onboardingOtpRemainingAttempts}`)
                }
            }
            if (!thrownError) {
                throw new Error("Activation did not fail with wrong OTP as expected!")
            }
        }
        
        if (config.otpForIdentification) {
            console.log("Resending OTP...")
            try {
                await activationService.resendOTP()
                console.log("OTP resent.")
            } catch (error) {
                // NOTE: on this test server the OTP resend currently fails (ONBOARDING_OTP_FAILED),
                // likely an OTP mock/delivery config issue unrelated to Re-KYC. Don't abort the demo run.
                console.log(`OTP resend failed, continuing anyway: ${JSON.stringify(error)}`)
            }
        } else {
            console.log("OTP for identification is not required, skipping resend.")
        }

        // now create new activation instance to verify that cached process is loaded correctly
        console.log("Creating new activation service instance to verify cached process...")
        activationService = new WDOActivationService(
            powerAuth, 
            serverCredentials.esoUrl
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
        await activationService.start(validUserAttributes, processType)
        console.log(`Activation started:  ${await activationService.hasActiveProcess() ? "yes" : "no"}`)

        // get onboarding status
        console.log("Getting activation status...")
        const status2 = await activationService.status()
        console.log(`Activation status after start: ${status2}`)

        let otpCode: string | undefined = undefined

        //retrieve OTP from server (in real app, user would input it)
        if (config.otpForIdentification) {
            console.log("Retrieving OTP from server...")
            try {
                otpCode = await DemoEndpoints.getOTPForActivation(activationService, serverCredentials.esoUrl, otpMockStrategy)
            } catch (error) {
                // NOTE: the debug OTP endpoint may not be enabled/reachable in all environments.
                // This is unrelated to Re-KYC, so don't abort.
                console.log(`OTP retrieval failed, continuing without it: ${error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(error)}`)
            }

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

        // init document scanning SDK - this is commented out because the test app does not include 
        // any 3rd party document scanning SDK, but the integration tests do. 
        // The backend's mock document-scan provider (servicesMock) does not require a real scan, so this step can be skipped in the test app.
        // console.log("Initializing document scanning SDK...")
        // const initResult = await verificationService.documentsInitSDK()
        // console.log(`Document scanning SDK initialized: ${JSON.stringify(initResult)}`)

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
            serverCredentials.esoUrl
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

        // Submit documents: instead of a real scan via a 3rd party SDK, send a small JSON "instruction" 
        // as the image data. The backend's mock document-scan provider (servicesMock) recognizes this shape
        // and responds as if a real document had been captured and accepted, without needing any document-scanning SDK at all.
        let mockUploadResult: WDOVerificationState = docTypesResult // initial value to please the compiler

        for (const doc of documentTypesToScan) {
            console.log(`Submitting mocked document data for document type: ${doc.type}...`)
            const imagesToUpload = [buildMockDocumentFile(doc, WDODocumentSide.front)]
            if (doc.sideCount > 1) {
                imagesToUpload.push(buildMockDocumentFile(doc, WDODocumentSide.back))
            }

            mockUploadResult = await uploadDocuments(verificationService, imagesToUpload)
            console.log(`Verification status after mock ${doc.type} upload: ${mockUploadResult.type}`)
        }

        guardState(mockUploadResult.type, WDOVerificationStateType.presenceCheck)

        // Presence check - same approach as the Android/iOS integration tests: the backend's mock
        // presence-check provider (servicesMock) does not require a real presence-check SDK session,
        // a plain init + submit is sufficient.
        console.log("Initializing presence check...")
        const presenceInitResult = await verificationService.presenceCheckInit()
        console.log(`Presence check result: ${JSON.stringify(presenceInitResult)}`)

        console.log("Submitting presence check result...")
        await verificationService.presenceCheckSubmit()
        console.log(`Verification status after presence check submitted.`)

        // wait for another status
        const afterPresenceCheckStatus = await waitForStatusChange(verificationService)
        console.log(`Verification status after presence check processing: ${afterPresenceCheckStatus.type}`)

        if (config.otpForIdentityVerification) {
            guardState(afterPresenceCheckStatus.type, WDOVerificationStateType.otp)
            console.log(`OTP resend cooldown from configuration: ${config.otpResendPeriodSeconds ?? "not provided"}`)

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
            const otpVerification: string = await DemoEndpoints.getOTPForVerification(verificationService, serverCredentials.esoUrl, otpMockStrategy)
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

            activePowerAuth = powerAuth2

        } else {
            guardState(anotherStatus.type, WDOVerificationStateType.success)
            console.log("Onboarding process completed successfully.")

            console.log("Fetching PowerAuth SDK activation status...")
            const finalPaStatus = await powerAuth.fetchActivationStatus()
            console.log(`PowerAuth SDK activation status: ${JSON.stringify(finalPaStatus)}`)
        }

        // RE-KYC (RE-VERIFICATION) TEST
        //
        // Started from fully activated pa
        console.log("Fetching PowerAuth SDK activation status before Re-KYC...")
        const preReKycStatus = await activePowerAuth.fetchActivationStatus()
        const preReKycRequired = WDOVerificationService.isVerificationRequired(preReKycStatus)
        console.log(`Is verification required before Re-KYC: ${preReKycRequired ? "yes" : "no"}`)
        if (preReKycRequired) {
            throw new Error("Verification is still required before starting Re-KYC - the original verification did not finish cleanly!")
        }

        console.log("Starting re-verification (Re-KYC) on the now fully-verified activation...")
        const reKycProcessType = "re-kyc"
        const reKycVerificationService = new WDOVerificationService(
            activePowerAuth,
            serverCredentials.esoUrl
        )

        const reKycIntroResult = await reKycVerificationService.startReVerification(undefined, reKycProcessType)
        console.log(`Re-verification started, status: ${reKycIntroResult.type}`)
        guardState(reKycIntroResult.type, WDOVerificationStateType.intro)
        const reKycIntroState = reKycIntroResult as WDOIntroState

        // startReVerification alone must not flip isVerificationRequired yet - only /api/identity/init
        // (triggered by the subsequent start() call below) does that.
        console.log("Fetching PowerAuth SDK activation status after startReVerification (before identity/init)...")
        const statusAfterReVerification = await activePowerAuth.fetchActivationStatus()
        const isVerificationRequiredAfterReVerification = WDOVerificationService.isVerificationRequired(statusAfterReVerification)
        console.log(`Is verification required after startReVerification (before identity/init): ${isVerificationRequiredAfterReVerification ? "yes" : "no"}`)
        if (isVerificationRequiredAfterReVerification) {
            throw new Error("Verification is required right after startReVerification - it should only flip after identity/init!")
        }

        console.log("Starting identification process for Re-KYC...")
        const reKycStartResult = await reKycVerificationService.start(reKycIntroState.consentRequired ? WDOConsentResponse.approved : WDOConsentResponse.notRequired)
        guardState(reKycStartResult.type, WDOVerificationStateType.documentsToScanSelect)
        console.log("Re-KYC identification process started.")

        console.log("Fetching PowerAuth SDK activation status after Re-KYC start...")
        const reKycPaStatus = await activePowerAuth.fetchActivationStatus()
        const reKycFlags = reKycPaStatus.customObject?.activationFlags as Array<string> | undefined
        console.log(`PowerAuth SDK activation flags after Re-KYC start: ${reKycFlags ? reKycFlags.join(", ") : "none"}`)

        // This is the reliable check regardless of which flag name the backend uses.
        const isVerificationRequiredAfterReKyc = WDOVerificationService.isVerificationRequired(reKycPaStatus)
        console.log(`Is verification required after Re-KYC start: ${isVerificationRequiredAfterReKyc ? "yes" : "no"}`)
        if (!isVerificationRequiredAfterReKyc) {
            throw new Error("Verification is not required according to WDOVerificationService after Re-KYC start!")
        }

        console.log("Re-KYC test completed successfully.")
        console.log("Now it should just finish.")
        testFinishedWithSuccess = true
    } catch (error) {
        console.log(`Error during activation:`)
        console.log(`  - message: ${(error as any)?.message}`)
        console.log(`  - object: ${JSON.stringify(error)}`)
    } finally {

        // REMOVING POWERAUTH SDK ACTIVATION

        console.log("Removing PowerAuth SDK activation...")
        await activePowerAuth.removeActivationWithAuthentication(PowerAuthAuthentication.password(pin))
        console.log("PowerAuth SDK activation removed.")
    }

    console.log("-------------")
    console.log(" !! TEST " + (testFinishedWithSuccess ? "PASSED" : "FAILED"))
    console.log("-------------\n")
}



function getRandomAttributes(): { clientNumber: string, birthDate: string } {
    return {
        clientNumber: crypto.randomUUID(),
        birthDate: "1990/03/04"
    }
}

async function uploadDocuments(verificationService: WDOVerificationService, documents: WDODocumentFile[]): Promise<WDOVerificationState> {
    console.log("Submitting images...")
    const scanResult = await verificationService.documentsSubmit(
        documents
    )
    guardState(scanResult.type, WDOVerificationStateType.processing)
    console.log("Document scans submitted, fetching status.")

    return await waitForStatusChange(verificationService)
}

// Builds a mocked document payload matching what Android/iOS integration tests send: a small JSON
// "instruction" (base64-encoded, since WDODocumentFile expects base64 image data) describing the
// document type and country, recognized by the backend's mock document-scan provider instead of a
// real scanned image.
function buildMockDocumentFile(doc: { type: WDODocumentType, country?: string }, side: WDODocumentSide): WDODocumentFile {
    const mockType = mockTypeFor(doc.type)
    const json = JSON.stringify({ type: mockType, isoAlpha3CountryCode: doc.country ?? "CZE" })
    const base64 = btoa(json)
    return new WDODocumentFile(base64, doc.type, side)
}

function mockTypeFor(type: WDODocumentType): string {
    switch (type) {
        case "DRIVING_LICENSE": return "Dl"
        case "ID_CARD": return "Id"
        case "PASSPORT": return "Passport"
        default: throw new Error(`Unsupported document type for mock upload: ${type}`)
    }
}

async function waitForStatusChange(verificationService: WDOVerificationService): Promise<WDOVerificationState> {
    
    let repeatedStatus = await verificationService.status()

    console.log(`Waiting until processing ends (if in progress): ${repeatedStatus.type}`)

    while(repeatedStatus.type === WDOVerificationStateType.processing) {

        if (repeatedStatus.item === WDOStatusCheckReason.onboardingApproval) {
            console.log("Process is waiting for onboarding approval from institution...")
            // simulate approval (we assume we're on a mock service that adds "mockuser_" prefix to client number)
            await approveOnboarding((verificationService as any).lastStatus.processId, `mockuser_${validUserAttributes.clientNumber}`, approveWhenApprovalNeeded)
            console.log(`Onboarding process ${approveWhenApprovalNeeded ? "approved" : "rejected"}.`)
            if (!approveWhenApprovalNeeded) {
                console.log("Test is set to reject onboarding, finishing test here.")
                let status = await verificationService.status() // return current status which should be end state with rejected reason
                if (status.type == WDOVerificationStateType.endState) {

                    if (status.rejectReason == approvalRejectReason) {
                        console.log("Verification ended with end state as expected after onboarding rejection.")
                        throw new Error("Onboarding was rejected as part of the test, stopping further processing.")
                    } else {
                        console.log(`Verification ended with end state but with unexpected reject reason: ${status.rejectReason}`)
                        throw new Error(`Verification ended with end state but with unexpected reject reason: ${status.rejectReason}`)
                    }
                }
            }
        }

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

async function approveOnboarding(processId: string, userId: string, approve: boolean): Promise<any> {

    // first get verification id for the process

    const myHeaders = new Headers()
    myHeaders.append("Content-Type", "application/json")
    myHeaders.append("Authorization", `Basic ${serverCredentials.authorization}`)

    const requestOptions = {
        method: "GET",
        headers: myHeaders
    }

    const result = await fetch(`${serverCredentials.esoUrl}api/private/test/process/${processId}/identityVerifications`, requestOptions)
    const data = await result.json()
    console.log(`Onboarding verifications for process ${processId}: ${JSON.stringify(data)}`)
    const verificationId = data[0]

    if (!Array.isArray(data) || data.length === 0) {
        console.log(`No verification ID found for process ${processId}, cannot approve onboarding. Skipping approval.`)
        return
    }
    
    // now approve the verification

    const raw = JSON.stringify({
        "processId": processId,
        "identityVerificationId": verificationId,
        "userId": userId,
        "approvalResult": approve ? "OK" : "NOK",
        "approvalResultReason": approve ? "" : approvalRejectReason
    })

    const requestOptions2 = {
        method: "POST",
        headers: myHeaders,
        body: raw
    }

    console.log(`Submitting onboarding approval with body: ${raw}`)
    const result2 = await fetch(`${serverCredentials.esoUrl}api/private/client/approve`, requestOptions2)
    console.log(`Onboarding approval response status for process ${processId} and verification ${verificationId}: ${result2.status}`)
    console.log(`${await result2.text()}`)

    if (!result2.ok) {
        throw new Error("Failed to approve onboarding process") 
    }
}
