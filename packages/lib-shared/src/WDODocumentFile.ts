/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOScannedDocument } from "./WDOVerificationScanProcess"

/** Image of a document that can be sent to the backend for Identity Verification. */
export class WDODocumentFile {
    /** Raw data to upload. Make sure that the data aren't too big, hundreds of kbs should be enough. */
    public data: Uint8Array // The binary data of the document file
    /**
     * Image signature.
     * 
     * Optional, use only when the scan SDK supports this.
     */
    public dataSignature: string | undefined
    /** Type of the document. */
    public type: WDODocumentType
    /** Side of the document (`front` if the document is one-sided or only one side is expected). */
    public side: WDODocumentSide
    /**
     * For image reuploading when the previous file of the same document was rejected.
     * 
     * Without specifying this value, the document side won't be overwritten.
     */
    public originalDocumentId: string | undefined

    static fromScannedDocument(scannedDocument: WDOScannedDocument, side: WDODocumentSide, data: Uint8Array, dataSignature?: string): WDODocumentFile {
        const originalDocumentId = scannedDocument.sides.find(s => s.type === side)?.serverId
        return new WDODocumentFile(data, dataSignature, scannedDocument.type, side, originalDocumentId)
    }

    static fromRawData(data: Uint8Array, type: WDODocumentType, side: WDODocumentSide, originalDocumentId?: string, dataSignature?: string): WDODocumentFile {
        return new WDODocumentFile(data, dataSignature, type, side, originalDocumentId)
    }

    constructor(data: Uint8Array, dataSignature: string | undefined = undefined, type: WDODocumentType, side: WDODocumentSide, originalDocumentId: string | undefined) {
        this.data = data
        this.dataSignature = dataSignature
        this.type = type
        this.side = side
        this.originalDocumentId = originalDocumentId
    }
}

/** Type of the document. */ 
export enum WDODocumentType {
    /// National ID card
    idCard = "idCard",
    /// Passport
    passport = "passport",
    // Drivers license
    driversLicense = "driversLicense"
}

/** 
 * Available sides of the document
 * 
 * Front and back for ID card.
 * For passport and drivers license front only.
 */
export function WDODocumentTypeSides(type: WDODocumentType): WDODocumentSide[] {
    switch (type) {
        case WDODocumentType.idCard:
            return [WDODocumentSide.front, WDODocumentSide.back]
        case WDODocumentType.passport:
            return [WDODocumentSide.front]
        case WDODocumentType.driversLicense:
            return [WDODocumentSide.front]
    }
}

/// Side of the document
export enum WDODocumentSide {
    /** Front side of a document. Usually the one with the picture.
     * 
     * When a document has more than one side but only one side is used (for example passport), then such side is considered to be front.
     */
    front = "front",
    /** Back side of a document */
    back = "back"
}