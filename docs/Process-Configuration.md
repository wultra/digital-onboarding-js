# Process Configuration

With `WDOConfigurationService` you can retrieve the configuration of the onboarding process from the server. The configuration contains information about which steps are required to be performed during the onboarding process and which document types are supported or required for scanning.

## Retrieving the configuration

To retrieve the configuration, create an instance of `WDOConfigurationService` and call the `getConfiguration` method with the process type identifier.

Example:

```typescript
// create and configure PowerAuth instance
const powerAuth = new PowerAuth("my-pa-instance")
await powerAuth.configure({
    configuration: "ARCB+...jg==", // base64 PowerAuth configuration
    baseEndpointUrl: "https://my-server-deployment.com/enrollment-server/"
})

// create configuration service
const configurationService = new WDOConfigurationService(
    powerAuth,
    "https://my-server-deployment.com/enrollment-server-onboarding/"
)

const processType = "onboarding" // defined on your server (can be undefined for default process type)
const config = await configurationService.getConfiguration(processType)
console.log("Configuration:", config)
```

## Configuration response

```typescript
/** Configuration for the onboarding process */
interface WDOConfigurationResponse {
    /** Is the onboarding process enabled */
    enabled: boolean
    /** Is OTP required for the first part - identification/activation. */
    otpForIdentification: boolean
    /** Is OTP required for the second part - identity verification. */
    otpForIdentityVerification: boolean
    /** Is the onboarding process configured with temporary activation that should be exchanged for the permanent one. */
    useTemporaryActivation: boolean
    /** Time in seconds the user needs to wait between OTP resend calls. Undefined when the backend does not provide the value. */
    otpResendPeriodSeconds?: number
    /** Documents required for identity verification. */
    documents: {
        /** Number of total required documents */
        totalRequiredDocumentsCount: number
        /** Groups of documents */
        groups: Array<WDOConfigurationDocumentGroup>
    }
}

/** Group of documents in the configuration */
interface WDOConfigurationDocumentGroup {
    /** Number of required documents in the group */
    requiredDocumentsCount: number
    /** Documents in the group */
    items: Array<WDOConfigurationDocument>
}

/** Configuration for a document */
interface WDOConfigurationDocument {
    /** Type of the document */
    type: string
    /** Number of sides the document has */
    sideCount: number
}
```

Use `otpResendPeriodSeconds` to drive the cooldown for `resendOTP()` in your activation or verification UI.

## Read next
- [Device Activation](Device-Activation.md)
