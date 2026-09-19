"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insert = insert;
exports.insertMultiple = insertMultiple;
exports.innerInsertMultiple = innerInsertMultiple;
exports.insertMultipleAsync = insertMultipleAsync;
const hooks_js_1 = require("../components/hooks.js");
const inference_js_1 = require("../components/inference.js");
const internal_document_id_store_js_1 = require("../components/internal-document-id-store.js");
const components_js_1 = require("../components.js");
const errors_js_1 = require("../errors.js");
const utils_js_1 = require("../utils.js");
function insert(zbsearch, doc, language, skipHooks, options) {
    (0, inference_js_1.inferSchemaFromDocument)(zbsearch, doc);
    const errorProperty = zbsearch.validateSchema(doc, zbsearch.schema);
    if (errorProperty) {
        throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
    }
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.insert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.afterInsert);
    if (asyncNeeded) {
        return innerInsertAsync(zbsearch, doc, language, skipHooks, options);
    }
    return innerInsertSync(zbsearch, doc, language, skipHooks, options);
}
const ENUM_TYPE = new Set(['enum', 'enum[]']);
const STRING_NUMBER_TYPE = new Set(['string', 'number']);
async function innerInsertAsync(zbsearch, doc, language, skipHooks, options) {
    const { index, docs } = zbsearch.data;
    const id = zbsearch.getDocumentIndexId(doc);
    if (typeof id !== 'string') {
        throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
    }
    const internalId = (0, internal_document_id_store_js_1.getInternalDocumentId)(zbsearch.internalDocumentIDStore, id);
    if (!skipHooks) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.beforeInsert, zbsearch, id, doc);
    }
    if (!zbsearch.documentsStore.store(docs, id, internalId, doc)) {
        throw (0, errors_js_1.createError)('DOCUMENT_ALREADY_EXISTS', id);
    }
    const docsCount = zbsearch.documentsStore.count(docs);
    const indexableProperties = zbsearch.index.getSearchableProperties(index);
    const indexablePropertiesWithTypes = zbsearch.index.getSearchablePropertiesWithTypes(index);
    const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
    for (const [key, value] of Object.entries(indexableValues)) {
        if (typeof value === 'undefined')
            continue;
        const actualType = typeof value;
        const expectedType = indexablePropertiesWithTypes[key];
        validateDocumentProperty(actualType, expectedType, key, value);
    }
    await indexAndSortDocument(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options);
    if (!skipHooks) {
        await (0, hooks_js_1.runSingleHook)(zbsearch.afterInsert, zbsearch, id, doc);
    }
    return id;
}
function getInsertMetadata(zbsearch) {
    let indexableProperties = zbsearch.caches['indexableProperties'];
    let indexablePropertiesWithTypes = zbsearch.caches['indexablePropertiesWithTypes'];
    let sortableProperties = zbsearch.caches['sortableProperties'];
    let sortablePropertiesWithTypes = zbsearch.caches['sortablePropertiesWithTypes'];
    if (!indexableProperties) {
        indexableProperties = zbsearch.index.getSearchableProperties(zbsearch.data.index);
        indexablePropertiesWithTypes = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
        sortableProperties = zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
        sortablePropertiesWithTypes = zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting);
        zbsearch.caches['indexableProperties'] = indexableProperties;
        zbsearch.caches['indexablePropertiesWithTypes'] = indexablePropertiesWithTypes;
        zbsearch.caches['sortableProperties'] = sortableProperties;
        zbsearch.caches['sortablePropertiesWithTypes'] = sortablePropertiesWithTypes;
    }
    return {
        indexableProperties,
        indexablePropertiesWithTypes: indexablePropertiesWithTypes,
        sortableProperties: sortableProperties,
        sortablePropertiesWithTypes: sortablePropertiesWithTypes
    };
}
function innerInsertSync(zbsearch, doc, language, skipHooks, options) {
    const { index: _index, docs } = zbsearch.data;
    const id = zbsearch.getDocumentIndexId(doc);
    if (typeof id !== 'string') {
        throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
    }
    const internalId = (0, internal_document_id_store_js_1.getInternalDocumentId)(zbsearch.internalDocumentIDStore, id);
    if (!skipHooks && zbsearch.beforeInsert?.length) {
        (0, hooks_js_1.runSingleHook)(zbsearch.beforeInsert, zbsearch, id, doc);
    }
    if (!zbsearch.documentsStore.store(docs, id, internalId, doc)) {
        throw (0, errors_js_1.createError)('DOCUMENT_ALREADY_EXISTS', id);
    }
    const docsCount = zbsearch.documentsStore.count(docs);
    const { indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes } = getInsertMetadata(zbsearch);
    const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
    for (const [key, value] of Object.entries(indexableValues)) {
        if (typeof value === 'undefined')
            continue;
        const actualType = typeof value;
        const expectedType = indexablePropertiesWithTypes[key];
        validateDocumentProperty(actualType, expectedType, key, value);
    }
    indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes);
    if (!skipHooks && zbsearch.afterInsert?.length) {
        (0, hooks_js_1.runSingleHook)(zbsearch.afterInsert, zbsearch, id, doc);
    }
    return id;
}
function validateDocumentProperty(actualType, expectedType, key, value) {
    if ((0, components_js_1.isGeoPointType)(expectedType) &&
        typeof value === 'object' &&
        typeof value.lon === 'number' &&
        typeof value.lat === 'number') {
        return;
    }
    if ((0, components_js_1.isVectorType)(expectedType) && Array.isArray(value))
        return;
    if ((0, components_js_1.isArrayType)(expectedType) && Array.isArray(value))
        return;
    if (ENUM_TYPE.has(expectedType) && STRING_NUMBER_TYPE.has(actualType))
        return;
    if (actualType !== expectedType) {
        throw (0, errors_js_1.createError)('INVALID_DOCUMENT_PROPERTY', key, expectedType, actualType);
    }
}
async function indexAndSortDocument(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options) {
    for (const prop of indexableProperties) {
        const value = indexableValues[prop];
        if (typeof value === 'undefined')
            continue;
        const expectedType = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index)[prop];
        await zbsearch.index.beforeInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
        const internalId = zbsearch.internalDocumentIDStore.idToInternalId.get(id);
        await zbsearch.index.insert(zbsearch.index, zbsearch.data.index, prop, id, internalId, value, expectedType, language, zbsearch.tokenizer, docsCount, options);
        await zbsearch.index.afterInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
    }
    const sortableProperties = zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
    const sortableValues = zbsearch.getDocumentProperties(doc, sortableProperties);
    for (const prop of sortableProperties) {
        const value = sortableValues[prop];
        if (typeof value === 'undefined')
            continue;
        const expectedType = zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting)[prop];
        zbsearch.sorter.insert(zbsearch.data.sorting, prop, id, value, expectedType, language);
    }
}
function indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, options, cachedIndexTypes, cachedSortableProperties, cachedSortableTypes) {
    const indexTypes = cachedIndexTypes ?? zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
    const internalDocumentId = (0, internal_document_id_store_js_1.getInternalDocumentId)(zbsearch.internalDocumentIDStore, id);
    for (const prop of indexableProperties) {
        const value = indexableValues[prop];
        if (typeof value === 'undefined')
            continue;
        const expectedType = indexTypes[prop];
        zbsearch.index.beforeInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
        zbsearch.index.insert(zbsearch.index, zbsearch.data.index, prop, id, internalDocumentId, value, expectedType, language, zbsearch.tokenizer, docsCount, options);
        zbsearch.index.afterInsert?.(zbsearch.data.index, prop, id, value, expectedType, language, zbsearch.tokenizer, docsCount);
    }
    const sortableProperties = cachedSortableProperties ?? zbsearch.sorter.getSortableProperties(zbsearch.data.sorting);
    const sortableTypes = cachedSortableTypes ?? zbsearch.sorter.getSortablePropertiesWithTypes(zbsearch.data.sorting);
    const sortableValues = zbsearch.getDocumentProperties(doc, sortableProperties);
    for (const prop of sortableProperties) {
        const value = sortableValues[prop];
        if (typeof value === 'undefined')
            continue;
        const expectedType = sortableTypes[prop];
        zbsearch.sorter.insert(zbsearch.data.sorting, prop, id, value, expectedType, language);
    }
}
function insertMultiple(zbsearch, docs, batchSize, language, skipHooks, timeout) {
    const asyncNeeded = (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsertMultiple) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.insert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.afterInsert);
    if (asyncNeeded) {
        return innerInsertMultipleAsync(zbsearch, docs, batchSize, language, skipHooks, timeout);
    }
    return innerInsertMultipleSync(zbsearch, docs, batchSize, language, skipHooks, timeout);
}
async function innerInsertMultipleAsync(zbsearch, docs, batchSize = 1000, language, skipHooks, timeout = 0) {
    const ids = [];
    const processNextBatch = async (startIndex) => {
        const endIndex = Math.min(startIndex + batchSize, docs.length);
        const batch = docs.slice(startIndex, endIndex);
        for (const doc of batch) {
            const options = { avlRebalanceThreshold: batch.length };
            const id = await insert(zbsearch, doc, language, skipHooks, options);
            ids.push(id);
        }
        return endIndex;
    };
    const processAllBatches = async () => {
        let currentIndex = 0;
        while (currentIndex < docs.length) {
            const startTime = Date.now();
            currentIndex = await processNextBatch(currentIndex);
            if (timeout > 0) {
                const elapsedTime = Date.now() - startTime;
                const waitTime = timeout - elapsedTime;
                if (waitTime > 0) {
                    (0, utils_js_1.sleep)(waitTime);
                }
            }
        }
    };
    await processAllBatches();
    if (!skipHooks) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.afterInsertMultiple, zbsearch, docs);
    }
    return ids;
}
function insertBatchSync(zbsearch, batch, ids, language, skipHooks) {
    let { indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes } = getInsertMetadata(zbsearch);
    const batchOptions = { avlRebalanceThreshold: batch.length };
    const { docs: docsStore } = zbsearch.data;
    for (const doc of batch) {
        if ((0, inference_js_1.inferSchemaFromDocument)(zbsearch, doc)) {
            // New properties were registered: refresh the memoized metadata.
            ;
            ({ indexableProperties, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes } =
                getInsertMetadata(zbsearch));
        }
        const errorProperty = zbsearch.validateSchema(doc, zbsearch.schema);
        if (errorProperty) {
            throw (0, errors_js_1.createError)('SCHEMA_VALIDATION_FAILURE', errorProperty);
        }
        const id = zbsearch.getDocumentIndexId(doc);
        if (typeof id !== 'string') {
            throw (0, errors_js_1.createError)('DOCUMENT_ID_MUST_BE_STRING', typeof id);
        }
        const internalId = (0, internal_document_id_store_js_1.getInternalDocumentId)(zbsearch.internalDocumentIDStore, id);
        if (!skipHooks && zbsearch.beforeInsert?.length) {
            (0, hooks_js_1.runSingleHook)(zbsearch.beforeInsert, zbsearch, id, doc);
        }
        if (!zbsearch.documentsStore.store(docsStore, id, internalId, doc)) {
            throw (0, errors_js_1.createError)('DOCUMENT_ALREADY_EXISTS', id);
        }
        const docsCount = zbsearch.documentsStore.count(docsStore);
        const indexableValues = zbsearch.getDocumentProperties(doc, indexableProperties);
        indexAndSortDocumentSync(zbsearch, id, indexableProperties, indexableValues, docsCount, language, doc, batchOptions, indexablePropertiesWithTypes, sortableProperties, sortablePropertiesWithTypes);
        if (!skipHooks && zbsearch.afterInsert?.length) {
            (0, hooks_js_1.runSingleHook)(zbsearch.afterInsert, zbsearch, id, doc);
        }
        ids.push(id);
    }
}
function innerInsertMultipleSync(zbsearch, docs, batchSize = 1000, language, skipHooks, timeout = 0) {
    const ids = [];
    let i = 0;
    function processNextBatch() {
        const batch = docs.slice(i * batchSize, (i + 1) * batchSize);
        if (batch.length === 0)
            return false;
        insertBatchSync(zbsearch, batch, ids, language, skipHooks);
        i++;
        return true;
    }
    function processAllBatches() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const startTime = Date.now();
            const hasMoreBatches = processNextBatch();
            if (!hasMoreBatches)
                break;
            if (timeout > 0) {
                const elapsedTime = Date.now() - startTime;
                const waitTime = timeout - elapsedTime;
                if (waitTime > 0) {
                    (0, utils_js_1.sleep)(waitTime);
                }
            }
        }
    }
    processAllBatches();
    if (!skipHooks && zbsearch.afterInsertMultiple?.length) {
        (0, hooks_js_1.runMultipleHook)(zbsearch.afterInsertMultiple, zbsearch, docs);
    }
    return ids;
}
function innerInsertMultiple(zbsearch, docs, batchSize, language, skipHooks, timeout) {
    const asyncNeeded = needsAsyncInsert(zbsearch);
    if (asyncNeeded) {
        return innerInsertMultipleAsync(zbsearch, docs, batchSize, language, skipHooks, timeout);
    }
    return innerInsertMultipleSync(zbsearch, docs, batchSize, language, skipHooks, timeout);
}
function needsAsyncInsert(zbsearch) {
    return ((0, utils_js_1.isAsyncFunction)(zbsearch.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.afterInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.beforeInsert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.insert) ||
        (0, utils_js_1.isAsyncFunction)(zbsearch.index.afterInsert));
}
async function insertMultipleAsync(zbsearch, docs, options = {}) {
    const { batchSize = 100, language, skipHooks, onProgress } = options;
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw (0, errors_js_1.createError)('INVALID_BATCH_SIZE', batchSize);
    }
    const asyncNeeded = needsAsyncInsert(zbsearch);
    const total = docs.length;
    const ids = [];
    for (let start = 0; start < total; start += batchSize) {
        const batch = docs.slice(start, start + batchSize);
        if (asyncNeeded) {
            const insertOptions = { avlRebalanceThreshold: batch.length };
            for (const doc of batch) {
                ids.push(await insert(zbsearch, doc, language, skipHooks, insertOptions));
            }
        }
        else {
            insertBatchSync(zbsearch, batch, ids, language, skipHooks);
        }
        onProgress?.({ processed: ids.length, total });
        if (start + batchSize < total) {
            await (0, utils_js_1.yieldToEventLoop)();
        }
    }
    if (!skipHooks && zbsearch.afterInsertMultiple?.length) {
        await (0, hooks_js_1.runMultipleHook)(zbsearch.afterInsertMultiple, zbsearch, docs);
    }
    return ids;
}
//# sourceMappingURL=insert.js.map