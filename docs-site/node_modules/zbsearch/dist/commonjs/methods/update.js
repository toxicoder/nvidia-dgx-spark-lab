"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.update = update;
exports.updateMultiple = updateMultiple;
const hooks_js_1 = require("../components/hooks.js");
const errors_js_1 = require("../errors.js");
const insert_js_1 = require("./insert.js");
const remove_js_1 = require("./remove.js");
const utils_js_1 = require("../utils.js");
function update(zbsearch, id, doc, language, skipHooks) {
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdate);
    if (asyncNeeded) {
        return updateAsync(zbsearch, id, doc, language, skipHooks);
    }
    return updateSync(zbsearch, id, doc, language, skipHooks);
}
async function updateAsync(zbsearch, id, doc, language, skipHooks) {
    if (!skipHooks && zbsearch.beforeUpdate) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.beforeUpdate, zbsearch, id);
    }
    await (0, remove_js_1.remove)(zbsearch, id, language, skipHooks);
    const newId = await (0, insert_js_1.insert)(zbsearch, doc, language, skipHooks);
    if (!skipHooks && zbsearch.afterUpdate) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.afterUpdate, zbsearch, newId);
    }
    return newId;
}
function updateSync(zbsearch, id, doc, language, skipHooks) {
    if (!skipHooks && zbsearch.beforeUpdate) {
        (0, hooks_js_1.runSingleHook)(zbsearch.beforeUpdate, zbsearch, id);
    }
    (0, remove_js_1.remove)(zbsearch, id, language, skipHooks);
    const newId = (0, insert_js_1.insert)(zbsearch, doc, language, skipHooks);
    if (!skipHooks && zbsearch.afterUpdate) {
        (0, hooks_js_1.runSingleHook)(zbsearch.afterUpdate, zbsearch, newId);
    }
    return newId;
}
function updateMultiple(zbsearch, ids, docs, batchSize, language, skipHooks) {
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemove) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdate) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeUpdateMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterUpdateMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeRemoveMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterRemoveMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsertMultiple);
    if (asyncNeeded) {
        return updateMultipleAsync(zbsearch, ids, docs, batchSize, language, skipHooks);
    }
    return updateMultipleSync(zbsearch, ids, docs, batchSize, language, skipHooks);
}
async function updateMultipleAsync(zbsearch, ids, docs, batchSize, language, skipHooks) {
    if (!skipHooks) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.beforeUpdateMultiple, zbsearch, ids);
    }
    const docsLength = docs.length;
    for (let i = 0; i < docsLength; i++) {
        const errorProperty = zbsearch.validateSchema(docs[i], zbsearch.schema);
        if (errorProperty) {
            throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
        }
    }
    await (0, remove_js_1.removeMultiple)(zbsearch, ids, batchSize, language, skipHooks);
    const newIds = await (0, insert_js_1.innerInsertMultiple)(zbsearch, docs, batchSize, language, skipHooks);
    if (!skipHooks) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.afterUpdateMultiple, zbsearch, newIds);
    }
    return newIds;
}
function updateMultipleSync(zbsearch, ids, docs, batchSize, language, skipHooks) {
    if (!skipHooks) {
        (0, hooks_js_1.runMultipleHook)(zbsearch.beforeUpdateMultiple, zbsearch, ids);
    }
    const docsLength = docs.length;
    for (let i = 0; i < docsLength; i++) {
        const errorProperty = zbsearch.validateSchema(docs[i], zbsearch.schema);
        if (errorProperty) {
            throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
        }
    }
    (0, remove_js_1.removeMultiple)(zbsearch, ids, batchSize, language, skipHooks);
    const newIds = (0, insert_js_1.innerInsertMultiple)(zbsearch, docs, batchSize, language, skipHooks);
    if (!skipHooks) {
        (0, hooks_js_1.runMultipleHook)(zbsearch.afterUpdateMultiple, zbsearch, newIds);
    }
    return newIds;
}
//# sourceMappingURL=update.js.map