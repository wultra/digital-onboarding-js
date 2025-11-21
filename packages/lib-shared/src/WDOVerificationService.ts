/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOBaseApi } from './api/WDOBaseApi'
import { WDOCreateDocumentSubmitFileSide, WDOCreateDocumentSubmitFileType, WDODocumentSubmitFile, WDODocumentSubmitFileType, WDODocument, WDODocumentStatus, WDOIdentityStatusResponse, WDOIdentityVerificationPhase, WDOIdentityVerificationStatus, WDOOnboardingStatus } from './api/WDONetworkingObjects'
import { WDOLogger } from './WDOLogger'
import { WDOError } from './WDOError'
import { WDOEndStateReason, WDOVerificationState, WDOVerificationStateType } from './WDOVerificationState'
import { WDOVerificationScanProcess } from './WDOVerificationScanProcess'
import { WDODocumentFile, WDODocumentSide, WDODocumentType } from './WDODocumentFile'

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
    powerAuthActivationStatusChanged(sender: WDOBaseVerificationService, status: any): void // TODO: any + not called yet

    /** Called when state of the verification has changed. */
    verificationStatusChanged(sender: WDOBaseVerificationService, status: WDOVerificationState): void
}

/**
 * Service that can verify previously activated PowerAuthSDK instance.
 * 
 * When PowerAuthSDK instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * This can be confirmed in the `PowerAuthActivationStatus.needVerification` which will be `true`. TODO: fix API
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export abstract class WDOBaseVerificationService {

    /* @internal */
    protected abstract api: WDOBaseApi
    /* @internal */
    protected lastStatus: WDOIdentityStatusResponse | undefined = undefined
    /* @internal */
    private cachedProcess: WDOVerificationScanProcess | undefined = undefined // TODO: persistence?

    // PUBLIC API

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

            switch (response.identityVerificationStatus) {
                case WDOIdentityVerificationStatus.failed:
                case WDOIdentityVerificationStatus.rejected: 
                case WDOIdentityVerificationStatus.notInitialized:
                case WDOIdentityVerificationStatus.accepted:
                    WDOLogger.debug(`Status ${response.identityVerificationStatus} - clearing cache`)
                    this.cachedProcess = undefined
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
                    return this.processSuccess({ type: WDOVerificationStateType.intro })
                case WDONextStep.documentScan:
                    WDOLogger.debug("Verifying documents status")
                    const docsResponse = await this.api.verificationDocumentsStatus(response.processId)

                    WDOLogger.debug(`Documents status: ${JSON.stringify(docsResponse)}`)

                    const documents = docsResponse.documents

                    const cachedProcess = this.cachedProcess

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
    async consentGet(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationGetConsentText(pid))
        return this.processSuccess({ type: WDOVerificationStateType.consent, body: response.consentText })
    }
    
    /**
     * Approves the consent for this process and starts the activation.
     */
    async consentApprove(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationResolveConsent(pid, true))
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
    async documentsInitSDK(challenge?: string): Promise<any> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationInitScanSDK(pid, challenge ?? "-")) // TODO: is "-" acceptable?
        return response
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
        this.cachedProcess = process
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
    async documentsSubmit(files: WDODocumentFile[], zipFolderNameDemo: string, base64zipDemo: string): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()

        const resubmit = files.some(f => f.originalDocumentId != undefined)

        const submitFiles: WDODocumentSubmitFile[] = files.map(f => {

            return {
                filename: `${zipFolderNameDemo}/${f.type.toLowerCase()}_${f.side.toLowerCase()}.jpg`,
                type: WDOCreateDocumentSubmitFileType(f.type),
                side: WDOCreateDocumentSubmitFileSide(f.side),
                originalDocumentId: f.originalDocumentId
            }
        })

        await this.handleError(this.api.verificationSubmitDocuments(pid, base64zipDemo, resubmit, submitFiles))
        return this.processSuccess({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentUpload })
    }

    /**
     * Initiates the presence check. This returns attributes that are needed to start the 3rd party SDK (if needed).
     */
    async presenceCheckInit(): Promise<any> { // TODO: proper return type?
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
        this.cachedProcess = undefined
        WDOLogger.info("Verification process restarted.")
        return this.processSuccess({ type: WDOVerificationStateType.intro })
    }

    /**
     * Cancel the whole activation/verification. After this it's no longer possible to call
     * any API of this library and PowerAuth activation should be removed and activation started again.
     */
    async cancelWholeProcess(): Promise<void> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationCleanup(pid))
        this.cachedProcess = undefined
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
                throw this.processError(new WDOError("OTP verification failed, no remaining attempts or OTP expired"))
            }
        }
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
            throw new WDOError("Process id not available - did you start the verification process and fetched the status?")
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
    private processError(error: any): any {
        return error
        // TODO:
        // if error.networkIsNotReachable == false || error.restApiError?.errorCode == .authenticationFailure {
        //     api.networking.powerAuth.fetchActivationStatus { [weak self] status, _ in
                
        //         guard let self else {
        //             completion(.failure(.init(.init(reason: .unknown))))
        //             return
        //         }
                
        //         if let status, status.state != .active {
        //             D.error("PowerAuth status is not active (status\(status.state)) - notifying the delegate and returning and error.")
        //             self.delegate?.powerAuthActivationStatusChanged(self, status: status)
        //             self.markCompleted(.failure(.init(.init(reason: .wdo_verification_activationNotActive, error: error))), completion)
        //         } else {
        //             D.error(error)
        //             self.markCompleted(.failure(.init(error)), completion)
        //         }
        //     }
        // } else {
        //     D.error(error)
        //     markCompleted(.failure(.init(error)), completion)
        // }
    }
    
}

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
    failed = "failed",
    rejected = "rejected",
    success = "success"
}

/**
 * The reason for what we are waiting for. For example, we can wait for documents to be OCRed and matched against the database.
 * Use these values for better loading texts to tell the user what is happening - some tasks may take some time 
 * and it would be frustrating to just show a generic loading indicator.
 */
export enum WDOStatusCheckReason {
    unknown = "unknown",
    documentUpload = "documentUpload",
    documentVerification = "documentVerification",
    documentAccepted = "documentAccepted",
    documentsCrossVerification = "documentsCrossVerification",
    clientVerification = "clientVerification",
    clientAccepted = "clientAccepted",
    verifyingPresence = "verifyingPresence"
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
        case WDODocumentStatus.rejected, WDODocumentStatus.failed:
            return "error"
    }
    WDOLogger.debug(`Unknown document status: ${document.status} for document ID: ${document.id}`)
    return "error" // fallback
}