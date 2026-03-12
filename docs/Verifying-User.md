# Verifying the User

If your `PowerAuth` instance was activated via the `WDOActivationService`, it will be in the state that needs additional verification. Without such verification, it won't be able to properly sign requests.

Additional verification requires the user to scan their face and provide documents such as an ID card or passport.

## When is the verification needed?

Verification is needed if the `activationFlags` in the `PowerAuthActivationStatus` contains `VERIFICATION_PENDING` or `VERIFICATION_IN_PROGRESS` value.

<!-- begin box info -->
To simplify this check, you can use the `WDOVerificationService.isVerificationRequired` method that returns a boolean indicating whether verification is required.
<!-- end -->

Example:

```typescript
const powerAuth: PowerAuth // configured and activated PowerAuth instance

try {
    const status = await powerAuth.fetchActivationStatus()
    if (WDOVerificationService.isVerificationRequired(status)) {
        // navigate to the verification flow 
        // and call `WDOVerificationService.status`
    } else {
        // handle PA status
    }
} catch (error) {
    // handle error
}
```

## Example app flow

<p align="center"><img src="images/verification-mockup.png" alt="Example verification flow" width="100%" /></p>

<!-- begin box info -->
This mockup shows a __happy user flow__ of an example setup. Your usage may vary.   
The final flow (which screens come after another) is controlled by the backend.
<!-- end -->

## Server driven flow

- The screen that should be displayed is driven by the state on the server "session".   
- At the beginning of the verification process, you will call the status which will tell you what to display to the user and which function to call next.
- Each API call returns a result and a next screen to display.
- This repeats until the process is finished or an "end state" is presented which terminates the process.

## Possible state values

State is defined by the `WDOVerificationStateType` with the following possibilities:

```typescript
/** Types of the verification state */
enum WDOVerificationStateType {
    /** 
     * Show the verification introduction screen where the user can start the activation. 
     * 
     * The next step should be calling the `start()`.
     */
    intro = "intro",
    /**
     * Show document selection to the user. Which documents are available and how many
     * can the user select is up to your backend configuration.
     * 
     * The next step should be calling the `documentsSetSelectedTypes`.
     */
    documentsToScanSelect = "documentsToScanSelect",
    /**
     * User should scan documents - display UI for the user to scan all necessary documents.
     * 
     * The next step should be calling the `documentsSubmit`.
     */
    scanDocument = "scanDocument",
    /** 
     * The system is processing data - show loading with text hint from provided `WDOStatusCheckReason`.
     * 
     * The next step should be calling the `status`.
     */
    processing = "processing",
    /** 
     * The user should be presented with a presence check.
     * Presence check is handled by third-party SDK based on the project setup.
     * 
     * The next step should be calling the `presenceCheckInit` to start the check and `presenceCheckSubmit` to
     * mark it finished.  Note that these methods won't change the status and it's up to the app to handle the process of the presence check.
     */
    presenceCheck = "presenceCheck",
    /**
     * Show enter OTP screen with resend button.
     * 
     * The next step should be calling the `verifyOTP` with user-entered OTP.
     * The OTP is usually SMS or email.
     */
    otp = "otp",
    /**
     * Show "finish activation" with PIN prompt screen.
     * 
     * The next step should be calling the `finishActivation` with user entered PIN.
     */
    finishActivation = "finishActivation",
    /**
     * Verification failed and can be restarted
     * 
     * The next step should be calling the `restartVerification` or `cancelWholeProcess` based on
     * the user's decision if he wants to try it again or cancel the process.
     */
    failed = "failed",
    /**
     * Verification is canceled and the user needs to start again with a new PowerAuth activation.
     * 
     * The next step should be calling the `PowerAuth.removeActivationLocal()` and starting activation from scratch.
     */
    endState = "endState",
    /**
     * Verification was successfully ended. Continue into your app flow.
     */
    success = "success"
}
```

Based on the type value, additional data is provided in the union type `WDOVerificationState`.

Available data per state type:

```typescript
export type WDOVerificationState =
    | WDOIntroState
    | WDODocumentsToScanSelectState
    | WDOScanDocumentState
    | WDOProcessingState
    | WDOPresenceCheckState
    | WDOOtpState
    | WDOFinishActivation
    | WDOFailedState
    | WDOEndStateState
    | WDOSuccessState

/** 
 * Show the verification introduction screen where the user can start the activation. 
 * 
 * The next step should be calling the `start`.
 */
export interface WDOIntroState {
    type: WDOVerificationStateType.intro,
    /** Indicates whether the user consent is required to proceed */
    consentRequired: boolean
}

/**
 * Show document selection to the user. Which documents are available and how many
 * can the user select is up to your backend configuration.
 * 
 * The next step should be calling the `documentsSetSelectedTypes`.
 */
export interface WDODocumentsToScanSelectState {
    type: WDOVerificationStateType.documentsToScanSelect
}

/**
 * User should scan documents - display UI for the user to scan all necessary documents.
 * 
 * The next step should be calling the `documentsSubmit`.
 */
export interface WDOScanDocumentState {
    type: WDOVerificationStateType.scanDocument
    /** Scanning process that helps with the document scanning */
    process: WDOVerificationScanProcess
}

/** 
 * The system is processing data - show loading with text hint from provided `WDOStatusCheckReason`.
 * 
 * The next step should be calling the `status`.
 */
export interface WDOProcessingState {
    type: WDOVerificationStateType.processing
    /** Reason for the current processing state */
    item: WDOStatusCheckReason
}

/** 
 * The user should be presented with a presence check.
 * Presence check is handled by third-party SDK based on the project setup.
 * 
 * The next step should be calling the `presenceCheckInit` to start the check and `presenceCheckSubmit` to
 * mark it finished.  Note that these methods won't change the status and it's up to the app to handle the process of the presence check.
 */
export interface WDOPresenceCheckState {
    type: WDOVerificationStateType.presenceCheck
}

/**
 * Show enter OTP screen with resend button.
 * 
 * The next step should be calling the `verifyOTP` with user-entered OTP.
 * The OTP is usually SMS or email.
 */
export interface WDOOtpState {
    type: WDOVerificationStateType.otp
    /** Number of remaining attempts to enter the correct OTP. Available after a failed OTP attempt */
    remainingAttempts?: number
    /** Time in seconds that user needs to wait between OTP resend calls. Undefined when not provided by the server */
    otpResendPeriodSeconds?: number
}

/**
 * Show "finish activation" with PIN prompt screen.
 * 
 * The next step should be calling the `finishActivation` with user entered PIN.
 */
export interface WDOFinishActivation {
    type: WDOVerificationStateType.finishActivation
}

/**
 * Verification failed and can be restarted
 * 
 * The next step should be calling the `restartVerification` or `cancelWholeProcess` based on
 * the user's decision if he wants to try it again or cancel the process.
 */
export interface WDOFailedState {
    type: WDOVerificationStateType.failed
}

/**
 * Verification is canceled and the user needs to start again with a new PowerAuth activation.
 * 
 * The next step should be calling the `PowerAuth.removeActivationLocal()` and starting activation from scratch.
 */
export interface WDOEndStateState {
    type: WDOVerificationStateType.endState
    /** Reason for the end state */
    reason: WDOEndStateReason
    /** In case the reason is `rejected`, this field contains the reject reason if it was provided by the system. */
    rejectReason?: string
}

/**
 * Verification was successfully ended. Continue into your app flow.
 */
export interface WDOSuccessState {
    type: WDOVerificationStateType.success
}
```

## Additional server data

The `status()` method returns `WDOVerificationState & WDOVerificationStateServerData`. The `WDOVerificationStateServerData` part provides additional context about the current server-side process:

```typescript
/** Additional data that comes with the state from the server. */
export interface WDOVerificationStateServerData {
    /** Data specific to the verification process */
    serverData: WDOProcessServerData
}

/** Data specific to the verification process */
export interface WDOProcessServerData {
    /** Unique identifier for the verification process */
    processId: string
    /** Type of the verification process */
    processType: string
}
```

You can also retrieve the `processType` at any time after a successful `status()` call via the `processType` getter on the service:

```typescript
const verification: WDOVerificationService // configured instance
const type = verification.processType // e.g. "ONBOARDING", undefined if status was not yet called
```

## Creating an instance

To create an instance you will need a `PowerAuth` instance that is __already activated__.

<!-- begin box info -->
[Documentation for `PowerAuth`](https://github.com/wultra/react-native-powerauth-mobile-sdk).  
<!-- end -->


Example:
```typescript
// create and configure PowerAuth instance
const powerAuth = new PowerAuth("my-pa-instance")
await powerAuth.configure({
    configuration: "ARCB+...jg==", // base64 PowerAuth configuration
    baseEndpointUrl: "https://my-server-deployment.com/enrollment-server/"
})

// create activation service
const verification = new WDOVerificationService(
    powerAuth,
    "https://my-server-deployment.com/enrollment-server-onboarding/"
)
```

## Getting the verification status

When starting the verification flow for the first time (such as after a fresh app launch), you should retrieve the current verification state.

You should also retrieve the state after any operation fails, or whenever you are unsure about the next step in the verification process.

Most verification functions return both the result and the updated state, making it easier to determine what action to take next.

Getting the state directly:

```typescript
const verification: WDOVerificationService // configured instance
try {
    const vfStatus = await verification.status()
    // handle `WDOVerificationState` state and navigate to the expected screen
    if (vfStatus.type === WDOVerificationStateType.intro) {
        // display intro screen
    } else if (vfStatus.type === WDOVerificationStateType.documentsToScanSelect) {
        // display document selector
    }
    // ... other states
} catch (error) {
    if (error.verificationState) {
        // show expected screen based on the state
    } else {
        // navigate to error screen
    }
}
```

## Starting the identity verification

When the state is `intro`, the first step in the flow is to start the verification process by calling `start` function.

```typescript
const state: WDOVerificationState // we're assuming that the state is `intro` here (WDOIntroState)
const verification: WDOVerificationService // configured instance
try {
    let consentResult: WDOConsentResponse
    const introState = state as WDOIntroState
    if (introState.consentRequired) {
        const consentTextResponse = await verification.consentGet()
        // show consent screen to the user and get his approval
        // assuming user approved the consent here
        consentResult = WDOConsentResponse.approved
    } else {
        consentResult = WDOConsentResponse.notRequired
    }
    const startResult = await verification.start(consentResult)
    // process the returned state, should be `documentsToScanSelect` now
} catch (error) {
    if (error.verificationState) {
        // show expected screen based on the state
    } else {
        // navigate to error screen
    }
}
```

## Set document types to scan

After the user approves the consent, present a document selector for documents which will be scanned. The number and types of documents (or other rules like 1 type required) are completely dependent on your backend system integration. You can retrieve the list of available document types from the [configuration service](Process-Configuration.md) or have it hard-coded.

For example, your system might require a national ID and one additional document like a driver's license, passport, or any other government-issued personal document.

```typescript
const verification: WDOVerificationService // configured instance
try {
    // assuming user selected ID card and passport. The list of available document types can be retrieved from the configuration endpoint or hardcoded based on your backend setup.
    const docTypesResult = await verification.documentsSetSelectedTypes([
        "ID_CARD",
        "PASSPORT"
    ])
    // state will be in the `scanDocument` case here - display the document scanner
} catch (error) {
    if (error.verificationState) {
        // show expected screen based on the state
    } else {
        // navigate to error screen
    }
}
```

## Configuring the "Document Scan SDK"

<!-- begin box info -->
This step does not move the state of the process but is a "stand-alone" API call.
<!-- end -->

Since the document scanning itself is not provided by this library but by a 3rd party library, some of them need a server-side initialization.

If your chosen "document scan SDK" requires such a step, use this function to retrieve necessary data from the server.

Example:

```typescript
const verification: WDOVerificationService // configured instance
const challengeFromSDK = "..." // optional challenge from the scanning SDK
const initResult = await verification.documentsInitSDK(challengeFromSDK)
// use the `initResult` to initialize the scanning SDK
```

## Scanning a document

When the state of the process is `scanDocument` with the `WDOVerificationScanProcess` parameter, you need to present a document scan UI to the user. This UI needs
to guide through the scanning process - scanning one document after another and both sides (if the document requires so).

The whole UI and document scanning process is up to you and the 3rd party library you choose to use.

<!-- begin box warning -->
This step is the most complicated in the process as you need to integrate this SDK, another document-scanning SDK, and integrate your server-side expected logic. To
make sure everything goes as smoothly as possible, ask your project management to provide you with a detailed description/document of the required scenarios and expected documents
for your implementation.
<!-- end -->

## Uploading a document

When a document is scanned (both sides when required), it needs to be uploaded to the server.

<!-- begin box warning -->
__Images of the document should not be bigger than hundreds of kilobytes. Files that are too big will take longer time to upload and process on the server.__
<!-- end -->

To upload a document, use `documentsSubmit` function. Each side of a document is a single `WDODocumentFile` instance.

Example:

```typescript
const verification: WDOVerificationService // configured instance

const passportToUpload = WDODocumentFile(
    "BASE64_ENCODED_IMAGE_DATA", // raw image data from the document scanning library/photo camera
    "PASSPORT",
    WDODocumentSide.front, // passport has only front side
    undefined, // original id, optional (use only when re-uploading the file - for example when first upload was rejected because of a blur)
    undefined // signature, optional (use when provided by the document scanning library)
)
try {
    const result = await verification.documentsSubmit([passportToUpload])
    // state will be in the `processing` case here - display the processing screen
} catch (error) {
    if (error.verificationState) {
        // show expected screen based on the state
    } else {
        // navigate to error screen
    }
}
```

### `WDODocumentFile`

```typescript
/** Image of a document that can be sent to the backend for Identity Verification. */
declare class WDODocumentFile {
    /** Raw data to upload. Make sure that the data aren't too big, hundreds of kbs should be enough. */
    data: Base64EncodedJPEG;
    /**
     * Image signature.
     *
     * Optional, use only when the scan SDK supports this.
     */
    dataSignature: string | undefined;
    /** Type of the document. */
    type: WDODocumentType;
    /** Side of the document (`front` if the document is one-sided or only one side is expected). */
    side: WDODocumentSide;
    /**
     * For image reuploading when the previous file of the same document was rejected.
     *
     * Without specifying this value, the document side won't be overwritten.
     */
    originalDocumentId: string | undefined;
    /**
     * Create the document file from an image that can be sent to the backend for Identity Verification.
     *
     * @param scannedDocument Document to upload.
     * @param side The side of the document that the image captures.
     * @param data Raw image data. Make sure that the data aren't too big, hundreds of kbs should be enough.
     * @param dataSignature Signature of the image data. Optional, use only when the scan SDK supports this. `undefined` by default.
     * @returns Document file to upload.
     */
    static fromScannedDocument(scannedDocument: WDOScannedDocument, side: WDODocumentSide, data: Base64EncodedJPEG, dataSignature?: string): WDODocumentFile;
    /**
     * Image of a document that can be sent to the backend for Identity Verification.
     *
     * @param data Raw image data. Make sure that the data aren't too big, hundreds of kbs should be enough.
     * @param type Type of the document.
     * @param side The side of the document that the image captures.
     * @param originalDocumentId Original document ID In case of a reupload. If you've previously uploaded this type and side and won't specify the previous ID, the image won't be overwritten.
     * @param dataSignature Signature of the image data. Optional, use only when the scan SDK supports this. `undefined` by default.
     */
    constructor(data: Base64EncodedJPEG, type: WDODocumentType, side: WDODocumentSide, originalDocumentId?: string, dataSignature?: string);
}
```

<!-- begin box info -->
To create an instance of the `WDODocumentFile`, you can use `WDODocumentFile.fromScannedDocument`. The `WDOScannedDocument` is returned in the process status as a "next document to scan".
<!-- end -->

## Presence check

To verify that the user is present in front of the phone, a presence check is required. This is suggested by the `presenceCheck` state.

When this state is obtained, the following steps need to be done:

1. Call `presenceCheckInit` to initialize the presence check on the server. This call returns a dictionary of necessary data for the presence-check library to initialize.
2. Make the presence check by the third-party library
3. After the presence check is finished, call `presenceCheckSubmit` to tell the server you finished the process on the device.

## Verify OTP (optional step)

After the presence check is finished, the user will receive an SMS/email OTP and the `otp` state will be reported. When this state is received, prompt the user for the OTP and verify it via `verifyOTP` method.

The `otp` state also contains the number of possible OTP attempts. When attempts are depleted, the error state is returned.

Example:

```typescript
const verification: WDOVerificationService // configured instance
try {
    const otpStatus = await verificationService.verifyOTP("123456")
    // React to a new state returned in the result
} catch (error) {
    // handle error
}
```

## Finalizing the verification (optional)

When the state `finishActivation` is received, prompt the user for a PIN code. 

This PIN code is then used to activate a new `PowerAuth` object that will be used for signing requests.

Once the new `PowerAuth` instance is activated, the verification process is finished, and the user can proceed to the main app flow *with the new `PowerAuth` instance*.

<!-- begin box info -->
If the user's PIN used for the original activation should be equal to the one used for the new activation, then:
- Set the `validatePassword` parameter to `true` in the `finishActivation` call. 
- The `PowerAuthPassword` passed to the `finishActivation` needs to be reusable (`destroyOnUse` set to false - `new PowerAuthPassword(false)`).
<!-- end -->

Example:

```typescript
const verification: WDOVerificationService // configured instance
const newPaInstance: PowerAuth // new PowerAuth instance to be activated and then used in the app
try {
    const password = await PowerAuthPassword.fromString("user-password", false) // reusable password
    const finishResult = await verification.finishActivation(newPaInstance, "my-new-activation-name", password, true)
    // When here, the newPaInstance is activated and ready to use (to sign requests and so on).
    // The original PowerAuth instance used for the verification will be in the `REMOVED` state and the `verification` instance can't be used anymore.
} catch (error) {
    // handle error
}
```

## Success state

When a whole verification is finished, you will receive the `success` state. Show a success screen and navigate the user to a common activated flow.

At the same time, the verification flags from the PowerAuth status are removed.

## Failed state

When the process fails, a `failed` state is returned. This means that the current verification process has failed and the user can restart it (by calling the `restartVerification` function) and start again (by showing the intro).

## Endstate state

When the activation is no longer able to be verified (for example did several failed attempts or took too long to finish), the `endState` state is returned. In this state there's nothing the user can do to continue. `cancelWholeProcess` must be invoked, followed by calling `removeActivationLocal` on the PowerAuth object. After these steps, the user should be returned to the “fresh install” state.

The state contains a `reason` field of type `WDOEndStateReason`. When the reason is `rejected`, the optional `rejectReason` field may contain an explanation provided by the server.

## Read next

- [Language Configuration](Language-Configuration.md)