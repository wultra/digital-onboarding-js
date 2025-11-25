/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: add ERROR codes
export class WDOError {

    message: string
    additionalInfo?: any

    constructor(message: string, additionalInfo?: any) {
        this.message = message
        this.additionalInfo = additionalInfo
    }
}