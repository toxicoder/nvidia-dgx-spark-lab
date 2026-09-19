"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFacets = getFacets;
const errors_js_1 = require("../errors.js");
function sortAsc(a, b) {
    return a[1] - b[1];
}
function sortDesc(a, b) {
    return b[1] - a[1];
}
function sortingPredicateBuilder(order = 'desc') {
    return order.toLowerCase() === 'asc' ? sortAsc : sortDesc;
}
function getValueAtPath(doc, pathParts) {
    let value = doc;
    for (let i = 0; i < pathParts.length; i++) {
        if (value === null || value === undefined || typeof value !== 'object') {
            return undefined;
        }
        value = value[pathParts[i]];
    }
    return value;
}
function incrementNumberFacet(ranges, values, facetValue, alreadyInsertedValues) {
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (alreadyInsertedValues?.has(range.key)) {
            continue;
        }
        if (facetValue >= range.from && facetValue <= range.to) {
            const current = values[range.key];
            if (current === undefined) {
                values[range.key] = 1;
            }
            else {
                values[range.key] = current + 1;
                alreadyInsertedValues?.add(range.key);
            }
        }
    }
}
function incrementBooleanStringOrEnumFacet(values, propertyType, facetValue, alreadyInsertedValues) {
    const defaultValue = propertyType === 'boolean' ? 'false' : '';
    const value = facetValue?.toString() ?? defaultValue;
    if (alreadyInsertedValues?.has(value)) {
        return;
    }
    const current = values[value];
    values[value] = current === undefined ? 1 : current + 1;
    alreadyInsertedValues?.add(value);
}
function prepareRangeValues(ranges) {
    const values = {};
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        values[`${range.from}-${range.to}`] = 0;
    }
    return values;
}
function prepareRanges(ranges) {
    const prepared = Array.from({ length: ranges.length });
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        prepared[i] = {
            from: range.from,
            to: range.to,
            key: `${range.from}-${range.to}`
        };
    }
    return prepared;
}
function prepareFacet(facet, facetsConfig, propertyType, pathParts) {
    const getFacetValue = pathParts
        ? (doc) => getValueAtPath(doc, pathParts)
        : (doc) => doc[facet];
    let values = {};
    let process;
    let finalize = () => values;
    switch (propertyType) {
        case 'number': {
            const { ranges } = facetsConfig[facet];
            const preparedRanges = prepareRanges(ranges);
            values = prepareRangeValues(ranges);
            process = (doc) => {
                const facetValue = getFacetValue(doc);
                if (typeof facetValue === 'number') {
                    incrementNumberFacet(preparedRanges, values, facetValue);
                }
            };
            break;
        }
        case 'number[]': {
            const { ranges } = facetsConfig[facet];
            const preparedRanges = prepareRanges(ranges);
            values = prepareRangeValues(ranges);
            process = (doc) => {
                const facetValue = getFacetValue(doc);
                if (!Array.isArray(facetValue)) {
                    return;
                }
                const alreadyInsertedValues = new Set();
                for (let i = 0; i < facetValue.length; i++) {
                    incrementNumberFacet(preparedRanges, values, facetValue[i], alreadyInsertedValues);
                }
            };
            break;
        }
        case 'boolean':
        case 'enum':
        case 'string': {
            const innerType = propertyType;
            process = (doc) => {
                const facetValue = getFacetValue(doc);
                incrementBooleanStringOrEnumFacet(values, innerType, facetValue);
            };
            if (propertyType === 'string') {
                const stringFacetDefinition = facetsConfig[facet];
                const sortingPredicate = sortingPredicateBuilder(stringFacetDefinition.sort);
                const offset = stringFacetDefinition.offset ?? 0;
                const limit = stringFacetDefinition.limit ?? 10;
                finalize = () => Object.fromEntries(Object.entries(values)
                    .sort(sortingPredicate)
                    .slice(offset, offset + limit));
            }
            break;
        }
        case 'boolean[]':
        case 'enum[]':
        case 'string[]': {
            const innerType = propertyType === 'boolean[]' ? 'boolean' : 'string';
            process = (doc) => {
                const facetValue = getFacetValue(doc);
                if (!Array.isArray(facetValue)) {
                    return;
                }
                const alreadyInsertedValues = new Set();
                for (let i = 0; i < facetValue.length; i++) {
                    incrementBooleanStringOrEnumFacet(values, innerType, facetValue[i], alreadyInsertedValues);
                }
            };
            break;
        }
        default:
            throw (0, errors_js_1.createError)('FACET_NOT_SUPPORTED', propertyType);
    }
    return { values, process, finalize };
}
function getFacets(zbsearch, results, facetsConfig) {
    const facets = {};
    const facetKeys = Object.keys(facetsConfig);
    const properties = zbsearch.index.getSearchablePropertiesWithTypes(zbsearch.data.index);
    const docs = zbsearch.data.docs.docs;
    const preparedFacets = Array.from({ length: facetKeys.length });
    for (let i = 0; i < facetKeys.length; i++) {
        const facet = facetKeys[i];
        const pathParts = facet.includes('.') ? facet.split('.') : null;
        preparedFacets[i] = prepareFacet(facet, facetsConfig, properties[facet], pathParts);
        facets[facet] = {
            count: 0,
            values: preparedFacets[i].values
        };
    }
    const resultsLength = results.length;
    for (let i = 0; i < resultsLength; i++) {
        const doc = docs[results[i][0]];
        if (!doc) {
            continue;
        }
        for (let j = 0; j < facetKeys.length; j++) {
            preparedFacets[j].process(doc);
        }
    }
    for (let i = 0; i < facetKeys.length; i++) {
        const facet = facetKeys[i];
        const preparedFacet = preparedFacets[i];
        facets[facet].count = Object.keys(preparedFacet.values).length;
        facets[facet].values = preparedFacet.finalize();
    }
    return facets;
}
//# sourceMappingURL=facets.js.map