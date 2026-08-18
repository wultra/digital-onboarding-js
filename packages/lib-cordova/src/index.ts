/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

export * from '../../lib-shared/src/WDOVerificationState'
export { WDOVerificationServiceListener, WDOConsentResponse } from '../../lib-shared/src/WDOVerificationService'
export * from '../../lib-shared/src/WDOVerificationScanProcess'
export * from '../../lib-shared/src/WDODocumentFile'
export * from '../../lib-shared/src/WDOLogger'
export * from '../../lib-shared/src/api/WDONetworkingObjects'
export * from '../../lib-shared/src/WDOError'
export { WDOGetOTPEndpointStrategy } from '../../lib-shared/src/api/WDODemoEndpoints'

// setup platform specific implementations
import { WDOCordovaCache, WDOCordovaPlatformUtils, WDONetworkingCordovaIntegration, WDOPowerAuthCordovaIntegration } from './WDOCordovaPlatform'
import { WDOPlatform } from '../../lib-shared/src/WDOPlatform'
WDOPlatform.cache = new WDOCordovaCache()
WDOPlatform.networking = new WDONetworkingCordovaIntegration()
WDOPlatform.powerAuth = new WDOPowerAuthCordovaIntegration()
WDOPlatform.utils = new WDOCordovaPlatformUtils()

// services that depend on platform implementations
import { WDOBaseActivationService } from '../../lib-shared/src/WDOActivationService'
import { WDOBaseConfigurationService } from '../../lib-shared/src/WDOConfigurationService'
import { WDOBaseVerificationService } from '../../lib-shared/src/WDOVerificationService'
import { WDOBaseDemoEndpointsService } from '../../lib-shared/src/api/WDODemoEndpoints'

/**
 * Service that can activate PowerAuth instance by user weak credentials (like his email, phone number or client ID) + optional SMS OTP.
 * 
 * When the PowerAuth is activated with this service, `WDOVerificationService.isVerificationRequired` will be `true`
 * and you will need to verify the PowerAuth instance via `WDOVerificationService`.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOActivationService extends WDOBaseActivationService<PowerAuth> { }

/**
 * Service that can verify previously activated PowerAuth instance.
 * 
 * When PowerAuth instance was activated with weak credentials via `WDOActivationService`, user needs to verify his genuine presence.
 * 
 * This service operates against Wultra Onboarding server (usually ending with `/enrollment-onboarding-server`) and you need to configure networking service with the right URL.
 */
export class WDOVerificationService extends WDOBaseVerificationService<PowerAuth, PowerAuthPassword> {
    /** Checks if verification is required based on PowerAuth activation status */
    public static isVerificationRequired(paStatus: PowerAuthActivationStatus): boolean {
        return super.isVerificationRequiredInternal(paStatus)
    }
}

/** Service that provides configuration for the Wultra Digital Onboarding SDK. */
export class WDOConfigurationService extends WDOBaseConfigurationService<PowerAuth> { }

/**
 * Demo endpoints available only in Wultra Demo systems.
 *
 * This service operates against the same Wultra Onboarding server as `WDOActivationService`/`WDOVerificationService` -
 * construct it with the same `powerauth` instance and `baseUrl`.
 */
export class WDODemoEndpointsService extends WDOBaseDemoEndpointsService<PowerAuth> { }