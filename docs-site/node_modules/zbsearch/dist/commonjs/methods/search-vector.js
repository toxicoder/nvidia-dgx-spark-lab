"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.innerVectorSearch = innerVectorSearch;
exports.searchVector = searchVector;
const utils_js_1 = require("../utils.js");
const facets_js_1 = require("../components/facets.js");
const errors_js_1 = require("../errors.js");
const groups_js_1 = require("../components/groups.js");
const hooks_js_1 = require("../components/hooks.js");
const vector_js_1 = require("../trees/vector.js");
const pinning_manager_js_1 = require("../components/pinning-manager.js");
const fetch_documents_js_1 = require("./fetch-documents.js");
function innerVectorSearch(zbsearch, params, language, precomputedWhereFiltersIDs) {
    const vector = params.vector;
    if (vector && (!('value' in vector) || !('property' in vector))) {
        throw (0, errors_js_1.createError)('INVALID_VECTOR_INPUT', Object.keys(vector).join(', '));
    }
    const vectorIndex = zbsearch.data.index.vectorIndexes[vector.property];
    if (!vectorIndex) {
        throw (0, errors_js_1.createError)('UNKNOWN_VECTOR_PROPERTY', vector.property);
    }
    const vectorSize = vectorIndex.node.size;
    if (vector?.value.length !== vectorSize) {
        if (vector?.property === undefined || vector?.value.length === undefined) {
            throw (0, errors_js_1.createError)('INVALID_INPUT_VECTOR', 'undefined', vectorSize, 'undefined');
        }
        throw (0, errors_js_1.createError)('INVALID_INPUT_VECTOR', vector.property, vectorSize, vector.value.length);
    }
    const index = zbsearch.data.index;
    let whereFiltersIDs = precomputedWhereFiltersIDs;
    const hasFilters = Object.keys(params.where ?? {}).length > 0;
    if (hasFilters && whereFiltersIDs === undefined) {
        whereFiltersIDs = zbsearch.index.searchByWhereClause(index, zbsearch.tokenizer, params.where, language);
    }
    return vectorIndex.node.find(vector.value, params.similarity ?? vector_js_1.DEFAULT_SIMILARITY, whereFiltersIDs);
}
function searchVector(zbsearch, params, language = 'english') {
    const timeStart = (0, utils_js_1.getNanosecondsTime)();
    function performSearchLogic() {
        let results = innerVectorSearch(zbsearch, params, language).sort(utils_js_1.sortTokenScorePredicate);
        // Apply pinning rules after sorting but before pagination
        results = (0, pinning_manager_js_1.applyPinningRules)(zbsearch, zbsearch.data.pinning, results, undefined);
        let facetsResults = [];
        const shouldCalculateFacets = params.facets && Object.keys(params.facets).length > 0;
        if (shouldCalculateFacets) {
            const facets = (0, facets_js_1.getFacets)(zbsearch, results, params.facets);
            facetsResults = facets;
        }
        const vectorProperty = params.vector.property;
        const includeVectors = params.includeVectors ?? false;
        const limit = params.limit ?? 10;
        const offset = params.offset ?? 0;
        const hits = (0, fetch_documents_js_1.fetchDocuments)(zbsearch, results, offset, limit).filter(Boolean);
        let groups = [];
        if (params.groupBy) {
            groups = (0, groups_js_1.getGroups)(zbsearch, results, params.groupBy);
        }
        const timeEnd = (0, utils_js_1.getNanosecondsTime)();
        const elapsedTime = timeEnd - timeStart;
        const searchResult = {
            count: results.length,
            hits: hits,
            elapsed: {
                raw: Number(elapsedTime),
                formatted: (0, utils_js_1.formatNanoseconds)(elapsedTime)
            },
            ...(facetsResults ? { facets: facetsResults } : {}),
            ...(groups ? { groups } : {})
        };
        if (!includeVectors) {
            (0, utils_js_1.removeVectorsFromHits)(searchResult, [vectorProperty]);
        }
        return searchResult;
    }
    async function executeSearchAsync() {
        if (zbsearch.beforeSearch) {
            await (0, hooks_js_1.runBeforeSearch)(zbsearch.beforeSearch, zbsearch, params, language);
        }
        const results = performSearchLogic();
        if (zbsearch.afterSearch) {
            await (0, hooks_js_1.runAfterSearch)(zbsearch.afterSearch, zbsearch, params, language, results);
        }
        return results;
    }
    const asyncNeeded = zbsearch.beforeSearch?.length || zbsearch.afterSearch?.length;
    if (asyncNeeded) {
        return executeSearchAsync();
    }
    // Sync path
    return performSearchLogic();
}
//# sourceMappingURL=search-vector.js.map