/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { WDODocument, WDODocumentSubmitFileSide } from "./api/WDONetworkingObjects"
import { WDODocumentSide, WDODocumentType } from "./WDODocumentFile"

export class WDOVerificationScanProcess {

    public documents: WDOScannedDocument[]

    public get nextDocumentToScan(): WDOScannedDocument | undefined { return this.documents.find(d => d.uploadState !== UploadState.accepted) }

    constructor(types: [WDODocumentType]) {
        this.documents = types.map(t => new WDOScannedDocument(t))
    }

    feedServerData(documents: WDODocument[]) {
        const groups = documents.reduce<Map<string, WDODocument[]>>((map, doc) => {
            const key = doc.type
            const group = map.get(key) ?? [];
            group.push(doc);
            map.set(key, group);
            return map;
        }, new Map())

        groups.forEach((docs, type) => {
             // TODO: type missmatch?
            this.documents.find(d => d.type === type)?.processServerData(docs)
        })
    }
}

export class WDOScannedDocument {

    public type: WDODocumentType

    public get uploadState(): UploadState {
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

    // TODO: private set
    public sides = new Array<Side>()

    // TODO: fileprivate
    constructor(type: WDODocumentType) {
        this.type = type
    }

    // TODO: fileprivate
    processServerData(documents: WDODocument[]) {
        this.sides = documents.map(doc => new Side(doc.side == WDODocumentSubmitFileSide.front ? WDODocumentSide.front : WDODocumentSide.back, doc.id, (doc.errors?.length ?? 0) > 0 ? UploadState.rejected : UploadState.accepted))
    }
}

/** State of the document on the server. */
export enum UploadState {    
    /** The document was not uploaded yet. */
    notUploaded,
    
    /** The document was accepted by the server. */
    accepted,
    
    /** The document was rejected and needs to be re-uploaded. */
    rejected
}

/// Side of the uploaded document.
export class Side {
    
    /// Type of the side.
    public type: WDODocumentSide
    
    /// ID on the server. Use this ID in case of an reupload
    public serverId: string
    
    /// Upload state of the document
    public uploadState: UploadState

    constructor(type: WDODocumentSide, serverId: string, uploadState: UploadState) {
        this.type = type
        this.serverId = serverId
        this.uploadState = uploadState
    }
}

// TODO: cached data constructor
