"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDocumentsWithDistinct = fetchDocumentsWithDistinct;
exports.fetchDocuments = fetchDocuments;
const internal_document_id_store_js_1 = require("../components/internal-document-id-store.js");
const utils_js_1 = require("../utils.js");
function fetchDocumentsWithDistinct(zbsearch, uniqueDocsArray, offset, limit, distinctOn) {
    const docs = zbsearch.data.docs;
    // Keep track which values we already seen
    const values = new Map();
    // We cannot know how many results we will have in the end,
    // so we need cannot pre-allocate the array.
    const results = [];
    const resultIDs = new Set();
    const uniqueDocsArrayLength = uniqueDocsArray.length;
    let count = 0;
    for (let i = 0; i < uniqueDocsArrayLength; i++) {
        const idAndScore = uniqueDocsArray[i];
        // If there are no more results, just break the loop
        if (typeof idAndScore === 'undefined') {
            continue;
        }
        const [id, score] = idAndScore;
        if (resultIDs.has(id)) {
            continue;
        }
        const doc = zbsearch.documentsStore.get(docs, id);
        const value = (0, utils_js_1.getNested)(doc, distinctOn);
        if (typeof value === 'undefined' || values.has(value)) {
            continue;
        }
        values.set(value, true);
        count++;
        // We shouldn't consider the document if it's not in the offset range
        if (count <= offset) {
            continue;
        }
        results.push({ id: (0, internal_document_id_store_js_1.getDocumentIdFromInternalId)(zbsearch.internalDocumentIDStore, id), score, document: doc });
        resultIDs.add(id);
        // reached the limit, break the loop
        if (count >= offset + limit) {
            break;
        }
    }
    return results;
}
function fetchDocuments(zbsearch, uniqueDocsArray, offset, limit) {
    const docs = zbsearch.data.docs;
    const results = [];
    const end = Math.min(offset + limit, uniqueDocsArray.length);
    for (let i = offset; i < end; i++) {
        const idAndScore = uniqueDocsArray[i];
        if (typeof idAndScore === 'undefined') {
            break;
        }
        const [id, score] = idAndScore;
        const fullDoc = zbsearch.documentsStore.get(docs, id);
        results.push({ id: (0, internal_document_id_store_js_1.getDocumentIdFromInternalId)(zbsearch.internalDocumentIDStore, id), score, document: fullDoc });
    }
    return results;
}
//# sourceMappingURL=fetch-documents.js.map