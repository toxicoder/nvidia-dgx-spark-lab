"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsert = upsert;
exports.upsertMultiple = upsertMultiple;
const hooks_js_1 = require("../components/hooks.js");
const errors_js_1 = require("../errors.js");
const insert_js_1 = require("./insert.js");
const update_js_1 = require("./update.js");
const utils_js_1 = require("../utils.js");
function upsert(zbsearch, doc, language, skipHooks, options) {
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.insert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.afterInsert);
    if (asyncNeeded) {
        return upsertAsync(zbsearch, doc, language, skipHooks, options);
    }
    return upsertSync(zbsearch, doc, language, skipHooks, options);
}
async function upsertAsync(zbsearch, doc, language, skipHooks, options) {
    const id = zbsearch.getDocumentIndexId(doc);
    if (typeof id !== 'string') {
        throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
    }
    if (!skipHooks && zbsearch.beforeUpsert) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.beforeUpsert, zbsearch, id, doc);
    }
    // Check if document exists
    const existingDoc = zbsearch.documentsStore.get(zbsearch.data.docs, id);
    let resultId;
    if (existingDoc) {
        // Document exists, update it
        resultId = await (0, update_js_1.update)(zbsearch, id, doc, language, skipHooks);
    }
    else {
        // Document doesn't exist, insert it
        resultId = await (0, insert_js_1.insert)(zbsearch, doc, language, skipHooks, options);
    }
    if (!skipHooks && zbsearch.afterUpsert) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.afterUpsert, zbsearch, resultId, doc);
    }
    return resultId;
}
function upsertSync(zbsearch, doc, language, skipHooks, options) {
    const id = zbsearch.getDocumentIndexId(doc);
    if (typeof id !== 'string') {
        throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
    }
    if (!skipHooks && zbsearch.beforeUpsert) {
        (0, hooks_js_1.runSingleHook)(zbsearch.beforeUpsert, zbsearch, id, doc);
    }
    // Check if document exists
    const existingDoc = zbsearch.documentsStore.get(zbsearch.data.docs, id);
    let resultId;
    if (existingDoc) {
        // Document exists, update it
        resultId = (0, update_js_1.update)(zbsearch, id, doc, language, skipHooks);
    }
    else {
        // Document doesn't exist, insert it
        resultId = (0, insert_js_1.insert)(zbsearch, doc, language, skipHooks, options);
    }
    if (!skipHooks && zbsearch.afterUpsert) {
        (0, hooks_js_1.runSingleHook)(zbsearch.afterUpsert, zbsearch, resultId, doc);
    }
    return resultId;
}
function upsertMultiple(zbsearch, docs, batchSize, language, skipHooks) {
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdateMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdateMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemoveMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemoveMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.insert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.afterInsert);
    if (asyncNeeded) {
        return upsertMultipleAsync(zbsearch, docs, batchSize, language, skipHooks);
    }
    return upsertMultipleSync(zbsearch, docs, batchSize, language, skipHooks);
}
async function upsertMultipleAsync(zbsearch, docs, batchSize, language, skipHooks) {
    if (!skipHooks && zbsearch.beforeUpsertMultiple) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.beforeUpsertMultiple, zbsearch, docs);
    }
    // Validate all documents first
    const docsLength = docs.length;
    for (let i = 0; i < docsLength; i++) {
        const errorProperty = zbsearch.validateSchema(docs[i], zbsearch.schema);
        if (errorProperty) {
            throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
        }
    }
    // Separate documents into insert and update arrays
    const docsToInsert = [];
    const docsToUpdate = [];
    const idsToUpdate = [];
    for (const doc of docs) {
        const id = zbsearch.getDocumentIndexId(doc);
        if (typeof id !== 'string') {
            throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
        }
        const existingDoc = zbsearch.documentsStore.get(zbsearch.data.docs, id);
        if (existingDoc) {
            docsToUpdate.push(doc);
            idsToUpdate.push(id);
        }
        else {
            docsToInsert.push(doc);
        }
    }
    // Perform bulk operations
    const results = [];
    if (docsToUpdate.length > 0) {
        const updateResults = await (0, update_js_1.updateMultiple)(zbsearch, idsToUpdate, docsToUpdate, batchSize, language, skipHooks);
        results.push(...updateResults);
    }
    if (docsToInsert.length > 0) {
        const insertResults = await (0, insert_js_1.innerInsertMultiple)(zbsearch, docsToInsert, batchSize, language, skipHooks);
        results.push(...insertResults);
    }
    if (!skipHooks && zbsearch.afterUpsertMultiple) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.afterUpsertMultiple, zbsearch, results);
    }
    return results;
}
function upsertMultipleSync(zbsearch, docs, batchSize, language, skipHooks) {
    if (!skipHooks && zbsearch.beforeUpsertMultiple) {
        (0, hooks_js_1.runMultipleHook)(zbsearch.beforeUpsertMultiple, zbsearch, docs);
    }
    // Validate all documents first
    const docsLength = docs.length;
    for (let i = 0; i < docsLength; i++) {
        const errorProperty = zbsearch.validateSchema(docs[i], zbsearch.schema);
        if (errorProperty) {
            throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
        }
    }
    // Separate documents into insert and update arrays
    const docsToInsert = [];
    const docsToUpdate = [];
    const idsToUpdate = [];
    for (const doc of docs) {
        const id = zbsearch.getDocumentIndexId(doc);
        if (typeof id !== 'string') {
            throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
        }
        const existingDoc = zbsearch.documentsStore.get(zbsearch.data.docs, id);
        if (existingDoc) {
            docsToUpdate.push(doc);
            idsToUpdate.push(id);
        }
        else {
            docsToInsert.push(doc);
        }
    }
    // Perform bulk operations
    const results = [];
    if (docsToUpdate.length > 0) {
        const updateResults = (0, update_js_1.updateMultiple)(zbsearch, idsToUpdate, docsToUpdate, batchSize, language, skipHooks);
        results.push(...updateResults);
    }
    if (docsToInsert.length > 0) {
        const insertResults = (0, insert_js_1.innerInsertMultiple)(zbsearch, docsToInsert, batchSize, language, skipHooks);
        results.push(...insertResults);
    }
    if (!skipHooks && zbsearch.afterUpsertMultiple) {
        (0, hooks_js_1.runMultipleHook)(zbsearch.afterUpsertMultiple, zbsearch, results);
    }
    return results;
}
//# sourceMappingURL=upsert.js.map