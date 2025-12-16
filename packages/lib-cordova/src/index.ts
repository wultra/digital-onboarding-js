/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './WDOCordovaActivationService'
export * from './WDOCordovaVerificationService'
export * from './WDOCordovaConfigurationService'
export * from '../../lib-shared/src/WDOVerificationState'
export { WDOVerificationServiceListener, WDOConsentResponse } from '../../lib-shared/src/WDOVerificationService'
export * from '../../lib-shared/src/WDOVerificationScanProcess'
export * from '../../lib-shared/src/WDODocumentFile'
export * from '../../lib-shared/src/WDOLogger'
export * from '../../lib-shared/src/api/WDONetworkingObjects'

// setup default cache implementation
import { WDOCordovaCache } from './WDOCordovaCache'
import { WDODefaultCache } from '../../lib-shared/src/WDOCache'
WDODefaultCache.instance = new WDOCordovaCache()