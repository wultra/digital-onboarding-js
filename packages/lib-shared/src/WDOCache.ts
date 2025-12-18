/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WDOCache {
    set(key: string, value: string | undefined): Promise<void>
    get(key: string): Promise<string | undefined>
    has(key: string): Promise<boolean>
}

export class WDODefaultCache {
    static instance: WDOCache
}