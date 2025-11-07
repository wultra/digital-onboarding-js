/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

export class WDOLogger {

    static debug(message: string) {
        console.debug(`[WDO][DEBUG] ${message}`)
    }

    static info(message: string) {
        console.info(`[WDO][INFO] ${message}`)
    }

    static warn(message: string) {
        console.warn(`[WDO][WARN] ${message}`)
    }

    static error(message: string, error?: any) {
        console.error(`[WDO][ERROR] ${message}`, error)
    }
}