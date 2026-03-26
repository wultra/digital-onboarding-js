/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDOScannedDocument } from "./WDOVerificationScanProcess"

/** String that contains a Base64 encoded JPEG image */
export type Base64EncodedJPEG = string

/** Type of the document.
 * Expected values are like: `ID_CARD`, `PASSPORT`, `DRIVING_LICENSE`.
 * All possible values can be found at backend implementation:
 * https://github.com/wultra/enrollment-server/blob/develop/enrollment-server-onboarding-domain-model/src/main/java/com/wultra/app/enrollmentserver/model/enumeration/DocumentType.java
 * Values configured on backend can be fetched using `WDOConfigurationService.getConfiguration()`.
 * */
export type WDODocumentType = string

/** Image of a document that can be sent to the backend for Identity Verification. */
export class WDODocumentFile {
    /** Raw data to upload. Make sure that the data aren't too big, hundreds of kbs should be enough. */
    public data: Base64EncodedJPEG
    /**
     * Image signature.
     * 
     * Optional, use only when the scan SDK supports this.
     */
    public dataSignature: string | undefined
    /** Type of the document.
     * Expected values like: `ID_CARD`, `PASSPORT`, `DRIVING_LICENSE`.
     * All possible values can be found at backend implementation:
     * https://github.com/wultra/enrollment-server/blob/develop/enrollment-server-onboarding-domain-model/src/main/java/com/wultra/app/enrollmentserver/model/enumeration/DocumentType.java
     * Expected/possible values can be obtained from `WDOConfigurationService.getConfiguration()`.
     * */
    public type: WDODocumentType
    /** Side of the document (`front` if the document is one-sided or only one side is expected). */
    public side: WDODocumentSide
    /**
     * For image reuploading when the previous file of the same document was rejected.
     * 
     * Without specifying this value, the document side won't be overwritten.
     */
    public originalDocumentId: string | undefined

    /**
     * Create the document file from an image that can be sent to the backend for Identity Verification.
     * 
     * @param scannedDocument Document to upload.
     * @param side The side of the document that the image captures.
     * @param data Raw image data. Make sure that the data aren't too big, hundreds of kbs should be enough.
     * @param dataSignature Signature of the image data. Optional, use only when the scan SDK supports this. `undefined` by default.
     * @returns Document file to upload.
     */
    static fromScannedDocument(
        scannedDocument: WDOScannedDocument,
        side: WDODocumentSide,
        data: Base64EncodedJPEG,
        dataSignature?: string
    ): WDODocumentFile {
        const originalDocumentId = scannedDocument.sides.find(s => s.type === side)?.serverId
        return new WDODocumentFile(data, scannedDocument.type, side, originalDocumentId, dataSignature)
    }

    /**
     * Image of a document that can be sent to the backend for Identity Verification.
     * 
     * @param data Raw image data. Make sure that the data aren't too big, hundreds of kbs should be enough.
     * @param type Type of the document.
     * @param side The side of the document that the image captures.
     * @param originalDocumentId Original document ID In case of a reupload. If you've previously uploaded this type and side and won't specify the previous ID, the image won't be overwritten.
     * @param dataSignature Signature of the image data. Optional, use only when the scan SDK supports this. `undefined` by default.
     */
    constructor(
        data: Base64EncodedJPEG,
        type: WDODocumentType,
        side: WDODocumentSide,
        originalDocumentId?: string,
        dataSignature?: string
    ) {
        this.data = data
        this.dataSignature = dataSignature
        this.type = type
        this.side = side
        this.originalDocumentId = originalDocumentId
    }
}

/** Side of the document */
export enum WDODocumentSide {
    /** Front side of a document. Usually the one with the picture.
     * 
     * When a document has more than one side but only one side is used (for example, passport),
     * then such a side is considered to be front.
     */
    front = "FRONT",
    /** Backside of a document */
    back = "BACK"
}
