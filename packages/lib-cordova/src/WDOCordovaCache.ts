/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import "cordova-powerauth-mobile-sdk"
import { WDOCache } from '../../lib-shared/src/WDOCache'

export class WDOCordovaCache implements WDOCache {

    set(key: string, value: string | undefined): Promise<void> {
        if (value) {
            return PowerAuthStorageUtils.setString(key, value, PowerAuthStorageType.SECURE)
        } else {
            return PowerAuthStorageUtils.remove(key, PowerAuthStorageType.SECURE).then(() => { /* no-op */ })
        }
    }

    get(key: string): Promise<string | undefined> {
        return PowerAuthStorageUtils.getString(key, PowerAuthStorageType.SECURE)
    }

    has(key: string): Promise<boolean> {
        return PowerAuthStorageUtils.exists(key, PowerAuthStorageType.SECURE)
    }
}