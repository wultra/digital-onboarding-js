/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOApi } from './api/WDOApi'
import { WDODocumentSubmitFile, WDODocument, WDODocumentStatus, WDOIdentityStatusResponse, WDOIdentityVerificationPhase, WDOIdentityVerificationStatus } from './api/WDONetworkingObjects'
import { WDOLogger } from './WDOLogger'
import { WDOError, WDOErrorReason } from './WDOError'
import { WDOEndStateReason, WDOVerificationState, WDOVerificationStateType, WDOStatusCheckReason, WDOVerificationStateServerData } from './WDOVerificationState'
import { WDOVerificationScanProcess } from './WDOVerificationScanProcess'
import { WDODocumentFile, WDODocumentType } from './WDODocumentFile'
import { WDOPlatform, WDOPowerAuth, WDOPowerAuthActivationStatus, WDOPowerAuthPassword } from './WDOPlatform'

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
    powerAuthActivationStatusChanged(senderService: any, status: WDOPowerAuthActivationStatus): void

    /** Called when state of the verification has changed. */
    verificationStatusChanged(senderService: any, status: WDOVerificationState): void
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
 * Service that can verify a previously activated PowerAuth instance.
 * 
 * When a PowerAuth instance was activated with weak credentials via `WDOActivationService`, the user needs to verify his genuine presence.
 * This can be confirmed in the `WDOVerificationService.isVerificationRequired`, which will be `true`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`), and you need to configure a networking service with the right URL.
 */
export abstract class WDOBaseVerificationService<
    TPowerAuth extends WDOPowerAuth,
    TPowerAuthPassword extends WDOPowerAuthPassword
> {

    /** Checks if verification is required based on PowerAuth activation status */
    protected static isVerificationRequiredInternal(paStatus: WDOPowerAuthActivationStatus): boolean {
        const flags = paStatus.customObject?.activationFlags as Array<string> | undefined
        return !!flags && flags.some(f => f === "VERIFICATION_PENDING" || f === "VERIFICATION_IN_PROGRESS")
    }

    /** PowerAuth instance */
    readonly powerauth: TPowerAuth

    // INTERNALS
    private readonly api: WDOApi<TPowerAuth>

    /**
     * Creates service instance
     * 
     * @param powerauth Configured PowerAuth instance. This instance needs to be without valid activation.
     * @param baseUrl Base URL of the Wultra Digital Onboarding server. Usually ending with `/enrollment-onboarding-server`.
     */
    constructor(powerauth: TPowerAuth, baseUrl: string) {
        this.powerauth = powerauth
        this.api = new WDOApi(powerauth, baseUrl)
    }

    // --

    /* @internal */
    protected lastStatus: WDOIdentityStatusResponse | undefined = undefined

    /* @internal */
    private cacheKey(pid: string): string { return `wdocp_${pid}` }

    /* @internal */
    private async setCachedProcess(pid: string, process: WDOVerificationScanProcess | undefined): Promise<void> {
        await WDOPlatform.cache.set(this.cacheKey(pid), process?.dataForCache())
    }

    /* @internal */
    private async getCachedProcess(pid: string): Promise<WDOVerificationScanProcess | undefined> {
        const data = await WDOPlatform.cache.get(this.cacheKey(pid))
        if (!data) {
            return undefined
        }
        return WDOVerificationScanProcess.fromCachedData(data)
    }

    // PUBLIC API

    /** 
     * Accept language for the outgoing requests headers.
     * The default value is "en".
     *
     * Standard RFC "Accept-Language" https://tools.ietf.org/html/rfc7231#section-5.3.5
     * Response texts are based on this setting. For example, when "de" is set, server
     * will return error texts and other in German (if available).
     */
    public changeAcceptLanguage(language: string) {
        this.api.networking.acceptLanguage = language
    }

    /**
     * Type of the process.
     * 
     * The value is available after a successful status call.
     */
    public get processType(): string | undefined {
        return this.lastStatus?.processType
    }

    /**
     * Listener that retrieves information about the verification and activation changes.
     */
    public listener?: WDOVerificationServiceListener

    /**
     * Status of the verification.
     */
    async status(): Promise<WDOVerificationState & WDOVerificationStateServerData> {
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
                    await this.setCachedProcess(response.processId, undefined)
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
                    return this.processServerState({ type: WDOVerificationStateType.intro, consentRequired: response.consentRequired }, response)
                case WDONextStep.documentScan:
                    WDOLogger.debug("Verifying documents status")
                    const docsResponse = await this.api.verificationDocumentsStatus(response.processId)

                    WDOLogger.debug(`Documents status: ${JSON.stringify(docsResponse)}`)

                    const documents = docsResponse.documents

                    // local state of documents that the user has selected to provide
                    const cachedProcess = await this.getCachedProcess(response.processId)

                    if (cachedProcess) {

                        cachedProcess.feedServerData(documents)
                        await this.setCachedProcess(response.processId, cachedProcess)

                        if (documents.some(d => documentAction(d) === "error") || documents.some(d => d.errors != undefined && d.errors.length > 0)) {
                            WDOLogger.debug(`At least one document in error state: ${documents.some(d => documentAction(d) === "error")}, ${documents.some(d => d.errors != undefined && d.errors.length > 0)}`)
                            return this.processServerState({ type: WDOVerificationStateType.scanDocument, process: cachedProcess }, response)
                        } else if (documents.every(d => documentAction(d) === "proceed")) {
                            if (cachedProcess.nextDocumentToScan) {
                                WDOLogger.debug("All documents accepted, but we are expecting more documents to scan")
                                // all documents on the backend are accepted, but the user has selected more documents to scan
                                return this.processServerState({ type: WDOVerificationStateType.scanDocument, process: cachedProcess }, response)
                            }
                            // corner case state, when the verification status returns documents_upload, but verificationDocumentsStatus() returns
                            // that all documents are accepted (the change happens between the two API calls)
                            WDOLogger.debug("All documents accepted, proceeding")
                            return this.processServerState({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentVerification }, response)
                        } else if (documents.some(d => documentAction(d) === "wait")) {
                            WDOLogger.debug("At least one document still in progress, moving to processing")
                            return this.processServerState({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentVerification }, response)
                        } else if (documents.length == 0) {
                            WDOLogger.debug("No documents scanned, scan documents...")
                            return this.processServerState({ type: WDOVerificationStateType.scanDocument, process: cachedProcess }, response)
                        } else {
                            return this.processServerState({ type: WDOVerificationStateType.failed }, response)
                        }

                    } else {
                        if (documents.length == 0) {
                            return this.processServerState({ type: WDOVerificationStateType.documentsToScanSelect }, response)
                        } else {
                            return this.processServerState({ type: WDOVerificationStateType.failed }, response)
                        }
                    }
                case WDONextStep.presenceCheck:
                    return this.processServerState({ type: WDOVerificationStateType.presenceCheck }, response)
                case WDONextStep.otp:
                    return this.processServerState({ type: WDOVerificationStateType.otp, otpResendPeriodSeconds: response.config?.otpResendPeriodSeconds }, response)
                case WDONextStep.statusCheck:
                    return this.processServerState({ type: WDOVerificationStateType.processing, item: vf.statusCheckReason ?? WDOStatusCheckReason.unknown }, response)
                case WDONextStep.failed:
                    return this.processServerState({ type: WDOVerificationStateType.failed }, response)
                case WDONextStep.rejected:
                    return this.processServerState({ type: WDOVerificationStateType.endState, reason: WDOEndStateReason.rejected, rejectReason: response.rejectReason }, response)
                case WDONextStep.success:
                    return this.processServerState({ type: WDOVerificationStateType.success }, response)
                case WDONextStep.finishActivation:
                    return this.processServerState({ type: WDOVerificationStateType.finishActivation }, response)

            }

        } catch (error) {
            WDOLogger.error(`Error fetching verification status: ${JSON.stringify(error)}`)
            this.lastStatus = undefined
            throw await this.processError(error)
        }
    }

    /**
     * Returns consent text for the user to approve. The content of the text depends on the server configuration and might be plain text or HTML.
     * 
     * Consent text explains how the service will handle his document photos or selfie scans.
     */
    async consentGet(): Promise<string> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationGetConsentText(pid))
        return response.consentText
    }
    
    /**
     * Start the identity verification after the user approved the consent (if required)
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
                return this.processState({ type: WDOVerificationStateType.intro, consentRequired: this.lastStatus?.consentRequired ?? true }) // TODO: ok to assume true?
            case WDOConsentResponse.notRequired:
                WDOLogger.info("Consent not required - proceeding")
        }

        await this.handleError(this.api.verificationStart(pid))
        await this.setCachedProcess(pid, undefined) // clear cache when starting the verification
        return this.processState({ type: WDOVerificationStateType.documentsToScanSelect })
    }

    /**
     * Get the token for the document scanning SDK, when required.
     * 
     * This is needed, for example, for ZenID or BlinkID provider.
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
     * Note that this needs to be in sync with what the server expects based on the configuration.
     * 
     * @param types Types of documents to scan.
     */
    async documentsSetSelectedTypes(types: WDODocumentType[]): Promise<WDOVerificationState> {
        WDOLogger.debug(`Submitting selected document types: ${types}`)
        const process = new WDOVerificationScanProcess(types)
        await this.setCachedProcess(this.verifyHasActiveProcess(), process)
        return this.processState({ type: WDOVerificationStateType.scanDocument, process: process })
    }

    /**
     * Upload document files to the server. The order of the documents is up to you. 
     * Make sure that uploaded document is reasonable size so you're not uploading large files.
     * 
     * If you're uploading the same document file again, you need to include the `originalDocumentId`. If you don't include it,
     * this method will try to resolve the `originalDocumentId` from the cached process, so if you have previously uploaded the same document type and side, 
     * you can skip providing `originalDocumentId` here, and it will be filled in automatically. The recommended way is to always provide `originalDocumentId` when re-uploading the same document.
     * 
     * @param files Document files to upload.
     */
    async documentsSubmit(files: WDODocumentFile[]): Promise<WDOVerificationState> {
        
        const pid = this.verifyHasActiveProcess()

        const processedFiles = files.map(f => {
            return new WDODocumentFile(f.data, f.type, f.side, f.originalDocumentId, f.dataSignature) // clone the file to avoid mutating the original one with resolved originalDocumentId
        })

        // --
        // Following block fills in originalDocumentId for documents being re-uploaded without it.
        // The cached process is kept up-to-date with server-side IDs after each status() call,
        // so no extra server call is needed here.
        // The recommended way is to always provide the originalDocumentId when re-uploading the same document.
        // Note that this will be improved on the backend in the future via https://github.com/wultra/enrollment-server/issues/1650
        {
            const filesWithoutOriginalId = processedFiles.filter(f => f.originalDocumentId == undefined)
            const cachedProcess = filesWithoutOriginalId.length > 0 ? await this.getCachedProcess(pid) : undefined
            if (cachedProcess) {
                WDOLogger.debug(`Found cached process with documents: ${cachedProcess.documents.map(d => d.type + " " + `${d.sides.length} sides ` + d.sides.map(s => s.type).join("/")).join(", ")}`)
                for (const file of filesWithoutOriginalId) {
                    WDOLogger.debug(`Document ${file.type} ${file.side} does not have originalDocumentId, trying to find it from cached process...`)
                    const originalDocumentId = cachedProcess.documents.find(d => d.type == file.type)?.sides.find(s => s.type == file.side)?.serverId
                    if (originalDocumentId) {
                        WDOLogger.debug(`Found originalDocumentId ${originalDocumentId} for document ${file.type} ${file.side} from cached process`)
                        file.originalDocumentId = originalDocumentId
                    } else {
                        WDOLogger.debug(`Original document ID not found for document ${file.type} ${file.side} in cached process`)
                    }
                }
            }
        }
        // -- All documents should now have originalDocumentId if they are re-uploads, otherwise they will be treated as new uploads.

        const resubmit = processedFiles.some(f => f.originalDocumentId != undefined)

        const submitFiles: WDODocumentSubmitFile[] = processedFiles.map(f => {

            return {
                filename: `${f.type.toLowerCase()}_${f.side.toLowerCase()}.jpg`,
                type: f.type,
                side: f.side,
                originalDocumentId: f.originalDocumentId,
                data: f.data
            }
        })

        await this.handleError(this.api.verificationSubmitDocuments(pid, resubmit, submitFiles))
        return this.processState({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.documentUpload })
    }

    /**
     * Initiates the presence check. This returns attributes that are needed to start the 3rd party SDK (if needed).
     */
    async presenceCheckInit(): Promise<{ iProovVerificationToken?: string }> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verificationPresenceCheckInit(pid))
        return response.sessionAttributes
    }

    /** 
     * Call when presence check was finished in the 3rd party SDK.
     */
    async presenceCheckSubmit(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationPresenceCheckSubmit(pid))
        return this.processState({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.verifyingPresence })
    }

    /**
     * Verification restart. When successfully called, an intro screen should be presented.
     */
    async restartVerification(): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationCleanup(pid))
        await this.setCachedProcess(pid, undefined)
        WDOLogger.info("Verification process restarted.")
        // return new status
        return await this.status()
    }

    /**
     * Cancel the whole activation/verification. After this it's no longer possible to call
     * any API of this library, and PowerAuth activation should be removed, and activation started again.
     */
    async cancelWholeProcess(): Promise<void> {
        const pid = this.verifyHasActiveProcess()
        await this.handleError(this.api.verificationCleanup(pid))
        await this.setCachedProcess(pid, undefined)
        WDOLogger.info("Verification process canceled.")
    }

    /**
     * Verify OTP that user entered as a last step of the verification.
     * 
     * @param otp OTP that user obtained via another channel (usually SMS or email).
     */
    async verifyOTP(otp: string): Promise<WDOVerificationState> {
        const pid = this.verifyHasActiveProcess()
        const response = await this.handleError(this.api.verifyOTP(pid, otp))
        if (response.verified) {
            WDOLogger.info("OTP verified successfully.")
            return this.processState({ type: WDOVerificationStateType.processing, item: WDOStatusCheckReason.unknown })
        } else {
            if (response.remainingAttempts > 0 && response.expired == false) {
                WDOLogger.error(`OTP verification failed, remaining attempts: ${response.remainingAttempts}`)
                return this.processState({ type: WDOVerificationStateType.otp, remainingAttempts: response.remainingAttempts, otpResendPeriodSeconds: this.lastStatus?.config?.otpResendPeriodSeconds })
            } else {
                WDOLogger.error("OTP verification failed, no remaining attempts or OTP expired")
                throw await this.processError(new WDOError(WDOErrorReason.otpFailed, "OTP verification failed, no remaining attempts or OTP expired"))
            }
        }
    }

    /**
     * Finishes verification by creating a new PowerAuth activation on a given ` newPowerAuthInstance `.
     * 
     * Needs to be called when "activationFinish" next step is returned from the `status()` call.
     * 
     * The method verifies that the provided `password` is the same as used in the original activation
     * (if `validatePassword` is set to `true`), then it calls the server API to finish
     * the verification and obtain the activation code for the new activation. Finally, it creates
     * a new activation on `newPowerAuthInstance` using the obtained activation code and persists it
     * with the provided `newPassword`.
     * 
     * After successful completion, the original PowerAuth instance becomes invalid (`REMOVED` state) and cannot be used anymore.
     * 
     * @param newPowerAuthInstance PowerAuth instance where to create new activation. This instance must not have an existing activation.
     * @param newActivationName Name of the new activation to be created on `newPowerAuthInstance`.
     * @param newPassword Password to protect the new activation. In case `validatePassword` is `true`, this password must match the password of the original activation and must be reusable (not destroyed on use).
     * @param validatePassword If set to `true`, the method verifies that the provided `newPassword` matches the password of the original activation.
     * @param userIdentification Optional user identification object to be sent to the server during the finish activation process.
     */
    async finishActivation(
        newPowerAuthInstance: TPowerAuth, 
        newActivationName: string, 
        newPassword: TPowerAuthPassword, 
        validatePassword: boolean,
        userIdentification?: any
    ): Promise<WDOVerificationState> {

        try {

            const pid = this.verifyHasActiveProcess()

            if (validatePassword) {

                // password must be reusable
                if ((newPassword as any).destroyOnUse) { // TODO: ok? maybe make this property public in PowerAuthPassword?
                    throw new WDOError(
                        WDOErrorReason.invalidParameter, 
                        "The provided PowerAuthPassword is configured to be destroyed on use, which is not supported in finishActivation with validatePassword=true. Please provide a reusable PowerAuthPassword instance. (with destroyOnUse=false)"
                    )
                }
                // validate password against original activation
                await this.powerauth.validatePassword(newPassword)
            }

            const response = await this.handleError(this.api.verificationFinishActivation(pid, userIdentification))
            try {
                const activation = WDOPlatform.powerAuth.activationWithActivationCode(response.activationCode, newActivationName, undefined)
                await newPowerAuthInstance.createActivation(activation)
                await newPowerAuthInstance.persistActivation(WDOPlatform.powerAuth.authenticationWithPassword(newPassword))
            } catch (e) {
                // In case of failure, ensure no partial activation remains
                if (await newPowerAuthInstance.canStartActivation() == false) {
                    await newPowerAuthInstance.removeActivationLocal()
                }
                
                throw e // rethrow
            }
            return this.processState({ type: WDOVerificationStateType.success })

        } finally {
            await newPassword.clear() // destroy the password after use
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
            throw new WDOError(WDOErrorReason.processNotInProgress, "Process id not available - did you start the verification process and fetched the status?")
        }
        return pid
    }

    /* @internal */
    private processServerState(result: WDOVerificationState, response: WDOIdentityStatusResponse): WDOVerificationState & WDOVerificationStateServerData {
        const resultWithServerData = { ...result, serverData: { processId: response.processId, processType: response.processType } }
        return this.processState(resultWithServerData)
    }

    /* @internal */
    private processState<T extends WDOVerificationState>(result: T): T {
        this.listener?.verificationStatusChanged(this, result)
        return result
    }

    /* @internal */
    private handleError<T>(promise: Promise<T>): Promise<T> {
        return promise.catch(async error => {
            throw await this.processError(error)
        })
    }

    /* @internal */
    private async processError(error: any): Promise<any> {
        if (error.code === "AUTHENTICATION_ERROR") { // PowerAuth Authentication failure
            try {
                const status = await this.powerauth.fetchActivationStatus()
                if (status.state !== "ACTIVE") {
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
    /** Reason for status check, if applicable (only when the nextStep is `statusCheck`) */
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
        } else if (phase === WDOIdentityVerificationPhase.onboardingApproval) {
            switch (status) {
                case WDOIdentityVerificationStatus.failed:
                    WDOLogger.debug("Onboarding approval phase with failed status - moving to failed state")
                    nextStep = WDONextStep.failed
                    break
                case WDOIdentityVerificationStatus.rejected:
                    nextStep = WDONextStep.rejected
                    break
                default:
                    nextStep = WDONextStep.statusCheck
                    statusCheckReason = WDOStatusCheckReason.onboardingApproval
                    break
            }
        }

        WDOLogger.info(`Translated backend phase/status ${phase ?? "nil"}/${status} to next step: ${nextStep ?? "nil"}`)

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