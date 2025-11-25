/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

/** Log levels for Wultra Digital Onboarding. */
export enum WDOLogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4
}

/** Simple logger utility for Wultra Digital Onboarding SDK. */
export class WDOLogger {

    /** Current log level. Messages with a level higher than this will not be logged. */
    static logLevel: WDOLogLevel = WDOLogLevel.INFO

    /** Listener for custom logging implementation */
    static listener : WDOLoggerListener | null = null

    /* @internal */
    static debug(message: string) {
        this.log(WDOLogLevel.DEBUG, message)
    }

    /* @internal */
    static info(message: string) {
        this.log(WDOLogLevel.INFO, message)
    }

    /* @internal */
    static warn(message: string) {
        this.log(WDOLogLevel.WARN, message)
    }

    /* @internal */
    static error(message: string) {
        this.log(WDOLogLevel.ERROR, message)
    }

    /* @internal */
    private static log(level: WDOLogLevel, message: string, ) {
        if (level <= this.logLevel) {
            console.log(`[WDO][${WDOLogLevel[level]}] ${message}`)
        }
        if (this.listener) {
            this.listener.log(level, message)
        }
    }
}

/** Log listener for your custom logging implementation */
export interface WDOLoggerListener {
    log(level: WDOLogLevel, message: string): void
}