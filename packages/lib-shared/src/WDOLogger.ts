/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: add log level control
export class WDOLogger {

    static debug(message: string) {
        console.log(`[WDO][DEBUG] ${message}`)
    }

    static info(message: string) {
        console.log(`[WDO][INFO] ${message}`)
    }

    static warn(message: string) {
        console.log(`[WDO][WARN] ${message}`)
    }

    static error(message: string, error?: any) {
        console.log(`[WDO][ERROR] ${message}`, error)
    }
}