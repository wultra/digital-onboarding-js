# Process Configuration

With `WDOConfigurationService` you can retrieve the configuration of the onboarding process from the server. The configuration contains information about which steps are required to be performed during the onboarding process and which document types are supported or required for scanning.

## Retrieving the configuration

To retrieve the configuration, create an instance of `WDOConfigurationService` and call the `getConfiguration` method with the process type identifier.

Example:

```typescript

const powerAuth = new PowerAuth("my-pa-instance")
powerAuth.configure({
    configuration: "ARCB+...jg==", // base64 PowerAuth configuration
    baseEndpointUrl: "https://my-server-deployment.com/enrollment-server/"
})
const configurationService = new WDOConfigurationService(
    powerAuth,
    "https://my-server-deployment.com/enrollment-server-onboarding/"
)

const procesType = "onboarding" // defined on your server
const config = await configurationService.getConfiguration(procesType)
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
    type: string,
    /** Number of sides the document has */
    sideCount: number
}
```

## Read next
- [Device Activation](Device-Activation.md)