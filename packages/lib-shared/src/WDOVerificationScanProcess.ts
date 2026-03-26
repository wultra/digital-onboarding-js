/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WDODocument } from "./api/WDONetworkingObjects"
import type { WDODocumentSide, WDODocumentType } from "./WDODocumentFile"
import { WDOLogger } from "./WDOLogger"

/** Describes the state of documents that need to be uploaded to the server. */
export class WDOVerificationScanProcess {

    /** All documents that need to be scanned. */
    documents: WDOScannedDocument[]

    /** Which document should be scanned next. `undefined` when all documents are uploaded and accepted. */
    get nextDocumentToScan(): WDOScannedDocument | undefined {
        return this.documents.find(d => d.uploadState !== UploadState.accepted)
    }

    /* @internal */
    constructor(input: WDODocumentType[] | WDOScannedDocument[]) {
        if (input.length > 0 && input[0] instanceof WDOScannedDocument) {
            this.documents = input as WDOScannedDocument[]
        } else {
            this.documents = (input as WDODocumentType[]).map(t => new WDOScannedDocument(t))
        }
    }

    /* @internal */
    feedServerData(documents: WDODocument[]) {
        for (const documentToScan of this.documents) {
            let serverDocuments = documents.filter(d => d.type === documentToScan.type)
            documentToScan.processServerData(serverDocuments)
        }
    }

    /* @internal */
    static fromCachedData(data: string): WDOVerificationScanProcess | undefined {
        // v1 format: "v1:TYPE1,TYPE2,..."
        if (data.startsWith("v1:")) {
            const split = data.split(":")
            if (split.length != 2) {
                WDOLogger.error("WDOVerificationScanProcess.fromCachedData: invalid v1 cached data format")
                return undefined
            }
            const types = split[1].split(",")
            return new WDOVerificationScanProcess(types as WDODocumentType[])
        }

        // v2 format: JSON
        try {
            const parsed = JSON.parse(data) as CacheV2
            if (parsed.v !== 2) {
                WDOLogger.error(`WDOVerificationScanProcess.fromCachedData: unsupported cached data version: ${parsed.v}`)
                return undefined
            }
            const documents = parsed.documents.map(d => {
                const sides = d.sides.map(s => new Side(s.type as WDODocumentSide, s.serverId, s.uploadState))
                return new WDOScannedDocument(d.type as WDODocumentType, sides)
            })
            return new WDOVerificationScanProcess(documents)
        } catch (e) {
            WDOLogger.error(`WDOVerificationScanProcess.fromCachedData: failed to parse cached data: ${e}`)
            return undefined
        }
    }

    /* @internal */
    dataForCache(): string {
        const data: CacheV2 = {
            v: 2,
            documents: this.documents.map(d => ({
                type: d.type,
                sides: d.sides.map(s => ({
                    type: s.type,
                    serverId: s.serverId,
                    uploadState: s.uploadState
                }))
            }))
        }
        return JSON.stringify(data)
    }
}

/** Document that needs to be scanned during process. */
export class WDOScannedDocument {

    /** Type of the document. */
    type: WDODocumentType

    /** Upload state. */
    get uploadState(): UploadState {
        // if there are no sides, consider the document not uploaded
        if (this.sides.length === 0) {
            return UploadState.notUploaded
        }
        // if any side is rejected, consider whole document rejected
        for (const side of this.sides) {
            if (side.uploadState === UploadState.rejected) {
                return UploadState.rejected
            }
        }
        return UploadState.accepted
    }

    /** Sides of the document that were uploaded on the server. */
    get sides(): Side[] { return this._sides }

    /* @internal */
    private _sides: Side[]

    /* @internal */
    constructor(type: WDODocumentType, initialSides?: Side[]) {
        this.type = type
        this._sides = initialSides ?? []
    }

    /* @internal */
    processServerData(documents: WDODocument[]) {
        this._sides = documents.map(doc => new Side(doc.side, doc.id, (doc.errors?.length ?? 0) > 0 ? UploadState.rejected : UploadState.accepted))
    }
}

/** State of the document on the server. */
export enum UploadState {
    /** The document was not uploaded yet. */
    notUploaded,

    /** The server accepted the document. */
    accepted,

    /** The document was rejected and needs to be re-uploaded. */
    rejected
}

/** Side of the uploaded document. */
export class Side {

    /** Type of the side. */
    public type: WDODocumentSide

    /** ID on the server. Use this ID in case of an reupload */
    public serverId: string

    /** Upload state of the document */
    public uploadState: UploadState

    /* @internal */
    constructor(type: WDODocumentSide, serverId: string, uploadState: UploadState) {
        this.type = type
        this.serverId = serverId
        this.uploadState = uploadState
    }
}

// Cache format types

/* @internal */
interface CacheV2Side {
    type: string
    serverId: string
    uploadState: number
}

/* @internal */
interface CacheV2Document {
    type: string
    sides: CacheV2Side[]
}

/* @internal */
interface CacheV2 {
    v: 2
    documents: CacheV2Document[]
}
