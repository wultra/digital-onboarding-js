/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseApi } from './api/WDOBaseApi'
import { WDODocumentSubmitFile, WDODocument, WDODocumentStatus, WDOIdentityStatusResponse, WDOIdentityVerificationPhase, WDOIdentityVerificationStatus } from './api/WDONetworkingObjects'
import { WDOLogger } from './WDOLogger'
import { WDOError, WDOErrorReason } from './WDOError'
import { WDOEndStateReason, WDOVerificationState, WDOVerificationStateType, WDOStatusCheckReason } from './WDOVerificationState'
import { WDOVerificationScanProcess } from './WDOVerificationScanProcess'
import { WDOCreateDocumentSubmitFileSide, WDODocumentFile, WDODocumentType, WDODocumentTypeToSubmitType } from './WDODocumentFile'
import { WDOPowerAuthActivationState, WDOPowerAuthActivationStatus } from './WDOPowerAuthActivationStatus'
import { WDODefaultCache } from './WDOCache'

/**
 * Listener of the Verification Service that can listen on Verification Status and PowerAuth Status changes.
 */
export interface WDOVerificationServiceListener {
    /**
     * Called when PowerAuth activation status changed.
     * 
     *  Note that this happens only when error is returned in some of the Verification endpoints and this error indicates PowerAuth status change. For
     * example when the service finds out during the API call that the PowerAuth activation was removed or blocked on the server
     */
    powerAuthActivationStatusChanged(sender: WDOBaseVerificationService, status: WDOPowerAuthActivationStatus): void

    /** Called when state of the verification has changed. */
    verificationStatusChanged(sender: WDOBaseVerificationService, status: WDOVerificationState): void
}

/** Possible results of the user consent. */
export enum WDOConsentResponse {
    /** User approved the consent. */
    approved,
    /** User declined the consent. */
    declined,
    /** Consent is not required. */
    notRequired
}

/**
 * Service that can verify previously activated PowerAuth instance.
 * 
 * When PowerAuth instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * This can be confirmed in the `WDOVerificationService.isVerificationRequired` which will be `true`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export abstract class WDOBaseVerificationService {

    // -- ABSTRACT PROPERTIES AND METHODS THAT NEED TO BE IMPLEMENTED IN PLATFORM-SPECIFIC SUBCLASSES --

    /* @internal */
    protected abstract api: WDOBaseApi
    /* @internal */
    protected abstract changeAcceptLanguageImpl(language: string): void
    /* @internal */
    protected abstract fetchActivationStatus(): Promise<WDOPowerAuthActivationStatus>
    /* @internal */
    protected abstract getPAInstanceId(): string

    // --

    /* @internal */
    protected lastStatus: WDOIdentityStatusResponse | undefined = undefined

    /* @internal */
    private cacheKey(): string { return `wdocp_${this.getPAInstanceId()}` }

    /* @internal */
    private async setCachedProcess(process: WDOVerificationScanProcess | undefined): Promise<void> {
        await WDODefaultCache.instance.set(this.cacheKey(), process?.dataForCache())
    }

    /* @internal */
    private async getCachedProcess(): Promise<WDOVerificationScanProcess | undefined> {
        const data = await WDODefaultCache.instance.get(this.cacheKey())
        if (!data) {
            return undefined
        }
        return WDOVerificationScanProcess.fromCachedData(data)
    }

    // PUBLIC API

    /** 
     * Accept language for the outgoing requests headers.
     * Default value is "en".
     *
     * Standard RFC "Accept-Language" https://tools.ietf.org/html/rfc7231#section-5.3.5
     * Response texts are based on this setting. For example when "de" is set, server
     * will return error texts and other in german (if available).
     */
    public changeAcceptLanguage(language: string) {
        this.changeAcceptLanguageImpl(language)
    }

    /** Time in seconds that user needs to wait between OTP resend calls */
    public get otpResendPeriodSeconds(): number | undefined {
        return this.lastStatus?.config?.otpResendPeriodSeconds
    }

    /**
     * Listener that retrieves information about the verification and activation changes.
     */
    public listener?: WDOVerificationServiceListener

    /**
     * Status of the verification.
     */
    async status(): Promise<WDOVerificationState> {
        try {
            const response = await this.api.verificationStatus()
            WDOLogger.info("Verification status successfully retrieved.")
            WDOLogger.debug(`Verification status: ${JSON.stringify(response)}`)

            if (response.consentRequired == undefined) {
                WDOLogger.debug("Consent required flag not present in the response, assuming false")
                response.consentRequired = false
            }

            switch (response.identityVerificationStatus) {
                case WDOIdentityVerificationStatus.failed:
                case WDOIdentityVerificationStatus.rejected: 
                case WDOIdentityVerificationStatus.notInitialized:
                case WDOIdentityVerificationStatus.accepted:
                    WDOLogger.debug(`Status ${response.identityVerificationStatus} - clearing cache`)
                    await this.setCachedProcess(undefined)
                    break
                default:
                    // no-op
                    break
            }

            this.lastStatus = response
            const vf = new WDOVerificationStatus(response)
            WDOLogger.info(`Verification next step: ${vf.description()}`)

            switch (vf.nextStep) {
                case WDONextStep.intro:
                    return this.processSuccess({ type: WDOVerificationStateType.intro, consentRequired: response.consentRequired })
                case WDONextStep.documentScan:
                    WDOLogger.debug("Verifying documents status")
                    const docsResponse = await this.api.verificationDocumentsStatus(response.processId)

                    WDOLogger.debug(`Documents status: ${JSON.stringify(docsResponse)}`)

                    const documents = docsResponse.documents

                    const cachedProcess = await this.getCachedProcess()

                    if (cachedProcess) {
                        
                        cachedProcess.feedServerData(docsResponse.documents)

                        if (documents.some(d => documentAction(d) === "error") || documents.some(d => d.errors != undefined && d.errors.length > 0)) {
                            WDOLogger.debug(`At least one document in error state: ${documents.some(d => documentAction(d) === "error")}, ${documents.some(d => d.errors != undefined && d.errors.length > 0)}`)
                            return this.processSuccess({ type: WDOVerificationStateType.scanDocument, process: cachedProcess })
                        } else if (documents.every(d => documentAction(d) === "proceed")) {
                            WDOLogger.debug("All documents accepted, proceeding")
                            return this.processSuccess({ type: WDOVerificationStateType.scanDocument, process: cachedProcess })
                        } else if (documents.some(d => documentAction(d) === "wait")) {
                            WDOLogger.debug("At least one document still in progress, moving to processing")
                            return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentVerification })
                        } else if (documents.length == 0) {
                            WDOLogger.debug("No documents scanned, scan documents...")
                            return this.processSuccess({ type: WDOVerificationStateType.scanDocument, process: cachedProcess })
                        } else {
                            return this.processSuccess({ type: WDOVerificationStateType.failed })
                        }

                    } else {
                        if (documents.length == 0) {
                            return this.processSuccess({ type: WDOVerificationStateType.documentsToScanSelect })
                        } else {
                            return this.processSuccess({ type: WDOVerificationStateType.failed })
                        }
                    }
                case WDONextStep.presenceCheck:
                    return this.processSuccess({ type: WDOVerificationStateType.presenceCheck })
                case WDONextStep.otp:
                    return this.processSuccess({ type: WDOVerificationStateType.otp })
                case WDONextStep.statusCheck:
                    return this.processSuccess({ type: WDOVerificationStateType.processing, item: vf.statusCheckReason ?? WDOStatusCheckReason.unknown })
                case WDONextStep.failed:
                    return this.processSuccess({ type: WDOVerificationStateType.failed })
                case WDONextStep.rejected:
                    return this.processSuccess({ type: WDOVerificationStateType.endState, reason: WDOEndStateReason.rejected })
                case WDONextStep.success:
                    return this.processSuccess({ type: WDOVerificationStateType.success })
                case WDONextStep.finishActivation:
                    return this.processSuccess({ type: WDOVerificationStateType.finishActivation })

            }

        } catch (error) {
            WDOLogger.error(`Error fetching verification status: ${JSON.stringify(error)}`)
            this.lastStatus = undefined
            throw this.processError(error)
        }
    }

    /**
     * Returns consent text for user to approve. The content of the text depends on the server configuration and might be plain text or HTML.
     * 
     * Consent text explains how the service will handle his document photos or selfie scans.
     */
    async consentGet(): Promise<string> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationGetConsentText(pid))
        return response.consentText
    }
    
    /**
     * Start the identity verification after user approved the consent (if required)
     * 
     * @param consentApprovedByUser Response of the user to the consent. The hint can be obtained in the `status()` call (`consentRequired` property when the result is `intro`).
     */
    async start(consentApprovedByUser: WDOConsentResponse): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        switch (consentApprovedByUser) {
            case WDOConsentResponse.approved:
                WDOLogger.info("User approved consent - resolving on server")
                await this.handleError(this.api.verificationResolveConsent(pid, true))
                break
            case WDOConsentResponse.declined:
                WDOLogger.info("User declined consent - returning to intro state")
                await this.handleError(this.api.verificationResolveConsent(pid, false))
                return this.processSuccess({ type: WDOVerificationStateType.intro, consentRequired: this.lastStatus?.consentRequired ?? true }) // TODO: ok to assume true?
            case WDOConsentResponse.notRequired:
                WDOLogger.info("Consent not required - proceeding")
        }

        await this.handleError(this.api.verificationStart(pid))
        return this.processSuccess({ type: WDOVerificationStateType.documentsToScanSelect })
    }

    /**
     * Get the token for the document scanning SDK, when required.
     * 
     * This is needed for example for ZenID or BlinkID provider.
     * 
     * @param challenge Optional challenge provided by the scanning SDK.
     */
    async documentsInitSDK(challenge?: string): Promise<{ blinkIDKey?: string, zenIDToken?: string }> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationInitScanSDK(pid, challenge ?? "-")) // TODO: is "-" acceptable?
        const blinkID = response.attributes["license-key"]
        const zenId = response.attributes["zenid-sdk-init-response"]
        return { blinkIDKey: blinkID, zenIDToken: zenId }
    }

    /**
     * Set which documents will be scanned.
     * 
     * Note that this needs to be in sync what server expects based on the configuration.
     * 
     * @param types Types of documents to scan.
     */
    async documentsSetSelectedTypes(types: WDODocumentType[]): Promise<WDOVerificationState> {
        WDOLogger.debug(`Submitting selected document types: ${types}`)
        const process = new WDOVerificationScanProcess(types)
        await this.setCachedProcess(process)
        return this.processSuccess({ type: WDOVerificationStateType.scanDocument, process: process })
    }

    /**
     * Upload document files to the server. The order of the documents is up to you. 
     * Make sure that uploaded document are reasonable size so you're not uploading large files.
     * 
     * If you're uploading the same document file again, you need to include the `originalDocumentId` otherwise it will be rejected by the server.
     * 
     * @param files Document files to upload.
     */
    async documentsSubmit(files: WDODocumentFile[]): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()

        const resubmit = files.some(f => f.originalDocumentId != undefined)

        const submitFiles: WDODocumentSubmitFile[] = files.map(f => {

            return {
                filename: `${f.type.toLowerCase()}_${f.side.toLowerCase()}.jpg`,
                type: WDODocumentTypeToSubmitType(f.type),
                side: WDOCreateDocumentSubmitFileSide(f.side),
                originalDocumentId: f.originalDocumentId,
                data: f.data
            }
        })

        await this.handleError(this.api.verificationSubmitDocuments(pid, resubmit, submitFiles))
        return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentUpload })
    }

    /**
     * Initiates the presence check. This returns attributes that are needed to start the 3rd party SDK (if needed).
     */
    async presenceCheckInit(): Promise<{ iProovVerificationToken?: string }> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationPresenceCheckInit(pid))
        return this.processSuccess(response.sessionAttributes)
    }

    /** 
     * Call when presence check was finished in the 3rd party SDK.
     */
    async presenceCheckSubmit(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationPresenceCheckSubmit(pid))
        return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.verifyingPresence })
    }

    /**
     * Verification restart. When sucessfully called, intro screen should be presented.
     */
    async restartVerification(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationCleanup(pid))
        await this.setCachedProcess(undefined)
        WDOLogger.info("Verification process restarted.")
        // return new status
        return await this.status()
    }

    /**
     * Cancel the whole activation/verification. After this it's no longer possible to call
     * any API of this library and PowerAuth activation should be removed and activation started again.
     */
    async cancelWholeProcess(): Promise<void> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationCleanup(pid))
        await this.setCachedProcess(undefined)
        WDOLogger.info("Verification process canceled.")
    }

    /**
     * Verify OTP that user entered as a last step of the verification.
     * 
     * @param otp OTP that user obtained via other channel (usually SMS or email).
     */
    async verifyOTP(otp: string): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verifyOTP(pid, otp))
        if (response.verified) {
            WDOLogger.info("OTP verified successfully.")
            return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.unknown })
        } else {
            if (response.remainingAttempts > 0 && response.expired == false) {
                WDOLogger.error(`OTP verification failed, remaining attempts: ${response.remainingAttempts}`)
                return this.processSuccess({ type: WDOVerificationStateType.otp, remainingAttempts: response.remainingAttempts })
            } else {
                WDOLogger.error("OTP verification failed, no remaining attempts or OTP expired")
                throw this.processError(new WDOError(WDOErrorReason.otpFailed, "OTP verification failed, no remaining attempts or OTP expired"))
            }
        }
    }

    /* @internal */
    protected async finishActivationInternal(authObject: any, userIdentification: any | undefined, activateNewInstance: (activationCode: string) => Promise<void>): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationFinishActivation(pid, userIdentification))
        await activateNewInstance(response.activationCode)
        return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.unknown })
    }

    /**
     * Request OTP resend.
     * 
     * Since SMS or emails can fail to deliver, use this to send the OTP again.
     */
    async resendOTP(): Promise<void> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationResendOTP(pid))
    }

    /**
     * @internal
     * Demo endpoint available only in Wultra Demo systems.
     * 
     * If the app is running against our demo server, you can retrieve the OTP without needing to send SMS or emails.
     */
    private async getOTP(): Promise<String> {
        WDOLogger.debug("Activation: getting OTP from server (only for testing purposes)")
        const pid = this.verifyHasActiveProcess()
        return (await this.api.activationGetOTP(pid, "USER_VERIFICATION")).otpCode
    }

    // PRIVATE METHODS

    /* @internal */
    private verifyHasActiveProcess(): string {
        const pid = this.lastStatus?.processId
        if (!pid) {
            WDOLogger.error("Process id not available - did you start the verification process and fetched the status?")
            throw new WDOError(WDOErrorReason.processNotInProgress, "Process id not available - did you start the verification process and fetched the status?")
        }
        return pid
    }

    /* @internal */
    private processSuccess<T>(result: T): T {
        if ((result as WDOVerificationState).type !== undefined) {
            this.listener?.verificationStatusChanged(this, result as WDOVerificationState)
        }
        return result
    }

    /* @internal */
    private handleError<T>(promise: Promise<T>): Promise<T> {
        return promise.catch(error => {
            throw this.processError(error)
        })
    }

    /* @internal */
    private async processError(error: any): Promise<any> {
        if (error.code === "AUTHENTICATION_ERROR") { // PowerAuth Authentication failure
            try {
                const status = await this.fetchActivationStatus()
                if (status.state !== WDOPowerAuthActivationState.ACTIVE) {
                    WDOLogger.error(`PowerAuth status is not active (status${status.state}) - notifying the delegate and returning and error.`)
                    this.listener?.powerAuthActivationStatusChanged(this, status)
                    return new WDOError(WDOErrorReason.powerauthNotActivated, "PowerAuth activation is not active anymore")
                }
            } catch {
                // no-op
            }
        }

        return error
    }   
}

// INTERNAL CLASSES

/**
  @internal
  Internal status that works as a translation layer between server API and SDK API
*/
class WDOVerificationStatus {
    /** Expected next step */
    readonly nextStep: WDONextStep
    /** Reason for status check, if applicable (only when nextStep is `statusCheck`) */
    readonly statusCheckReason: WDOStatusCheckReason | undefined


    /** Translation from server status to phone status. */
    constructor(serverResponse: WDOIdentityStatusResponse) {

        const phase = serverResponse.identityVerificationPhase
        const status = serverResponse.identityVerificationStatus

        let nextStep: WDONextStep | undefined = undefined
        let statusCheckReason: WDOStatusCheckReason | undefined = undefined
        
        // UNDEFINED PHASE
        if (phase == undefined) {
            switch (status) {
                case WDOIdentityVerificationStatus.notInitialized: nextStep = WDONextStep.intro; break
                case WDOIdentityVerificationStatus.failed:         nextStep = WDONextStep.failed; break
                default:                                           break
            }
        }
        // DOCUMENT UPLOAD PHASE
        else if (phase === WDOIdentityVerificationPhase.documentUpload) {
            switch (status) {
                case WDOIdentityVerificationStatus.inProgress:      
                    nextStep = WDONextStep.documentScan
                    break
                case WDOIdentityVerificationStatus.verificationPending:
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.documentVerification
                    break
                case WDOIdentityVerificationStatus.failed:          
                    nextStep = WDONextStep.failed
                    break
                default:                                           
                    break
            }
        }
        // DOCUMENT VERIFICATION PHASE
        else if (phase === WDOIdentityVerificationPhase.documentVerification) {
            switch (status) {
                case WDOIdentityVerificationStatus.accepted:        
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.documentAccepted
                    break
                case WDOIdentityVerificationStatus.inProgress:      
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.documentVerification
                    break
                case WDOIdentityVerificationStatus.failed:          
                    nextStep = WDONextStep.failed
                    break
                case WDOIdentityVerificationStatus.rejected:        
                    nextStep = WDONextStep.rejected
                    break
                default:                                           
                    break
            }
        }
        // DOCUMENT VERIFICATION FINAL PHASE
        else if (phase === WDOIdentityVerificationPhase.documentVerificationFinal) {
            switch (status) {
                case WDOIdentityVerificationStatus.accepted:        
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.documentsCrossVerification
                    break
                case WDOIdentityVerificationStatus.inProgress:      
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.documentsCrossVerification
                    break
                case WDOIdentityVerificationStatus.failed:          
                    nextStep = WDONextStep.failed
                    break
                case WDOIdentityVerificationStatus.rejected:        
                    nextStep = WDONextStep.rejected
                    break
                default:                                           
                    break
            }
        }
        // CLIENT EVALUATION PHASE
        else if (phase === WDOIdentityVerificationPhase.clientEvaluation) {
            switch (status) {
                case WDOIdentityVerificationStatus.inProgress:
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.clientVerification
                    break
                case WDOIdentityVerificationStatus.accepted:
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.clientAccepted
                    break
                case WDOIdentityVerificationStatus.rejected:
                    nextStep = WDONextStep.rejected
                    break
                case WDOIdentityVerificationStatus.failed:
                    nextStep = WDONextStep.failed
                    break
                default:
                    break
            }
        }
        // PRESENCE CHECK PHASE
        else if (phase === WDOIdentityVerificationPhase.presenceCheck) {
            switch (status) {
                case WDOIdentityVerificationStatus.notInitialized: 
                case WDOIdentityVerificationStatus.inProgress:
                    nextStep = WDONextStep.presenceCheck
                    break
                case WDOIdentityVerificationStatus.verificationPending:
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.verifyingPresence
                    break
                case WDOIdentityVerificationStatus.failed:
                    nextStep = WDONextStep.failed
                    break
                case WDOIdentityVerificationStatus.rejected:
                    nextStep = WDONextStep.rejected
                    break
                default:
                    break
            }
        }
        // OTP PHASE
        else if (phase === WDOIdentityVerificationPhase.otp) {
            switch (status) {
                case WDOIdentityVerificationStatus.verificationPending:
                    nextStep = WDONextStep.otp
                    break
                default:
                    break
            }
        }
        // COMPLETED PHASE
        else if (phase === WDOIdentityVerificationPhase.completed) {
            switch (status) {
                case WDOIdentityVerificationStatus.accepted:
                    nextStep = WDONextStep.success
                    break
                case WDOIdentityVerificationStatus.failed:
                    nextStep = WDONextStep.failed
                    break
                case WDOIdentityVerificationStatus.rejected:
                    nextStep = WDONextStep.rejected
                    break
                default:
                    break
            }
        } else if (phase === WDOIdentityVerificationPhase.activationFinish) {
            // TODO: handle status?
            nextStep = WDONextStep.finishActivation
        }

        if (nextStep == undefined) {
            WDOLogger.error(`Unknown phase/status combo: ${phase ?? "nil"}, ${status}`)
            nextStep = WDONextStep.failed
        }

        this.nextStep = nextStep
        this.statusCheckReason = statusCheckReason
    }

    description(): string {
        let result = this.nextStep.toString()
        if (this.statusCheckReason) {
            result += `(${this.statusCheckReason})`
        }
        return result
    }
}

/* @internal */
enum WDONextStep {
    intro = "intro",
    documentScan = "documentScan",
    statusCheck = "statusCheck",
    presenceCheck = "presenceCheck",
    otp = "otp",
    finishActivation = "finishActivation",
    failed = "failed",
    rejected = "rejected",
    success = "success"
}

function documentAction(document: WDODocument): "proceed" | "wait" | "error" {
    switch (document.status) {
        case WDODocumentStatus.accepted:
            return "proceed"
        case WDODocumentStatus.uploadInProgress: 
        case WDODocumentStatus.inProgress:
        case WDODocumentStatus.verificationPending:
        case WDODocumentStatus.verificationInProgress:
            return "wait"
        case WDODocumentStatus.rejected:
        case WDODocumentStatus.failed:
            return "error"
    }
    WDOLogger.debug(`Unknown document status: ${document.status} for document ID: ${document.id}`)
    return "error" // fallback
}