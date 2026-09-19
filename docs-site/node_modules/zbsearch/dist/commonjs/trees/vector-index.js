"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFlatVectorIndexFactory = void 0;
exports.createFlatVectorIndexFactory = createFlatVectorIndexFactory;
exports.resolveVectorIndexFactory = resolveVectorIndexFactory;
exports.resolveVectorIndexConfig = resolveVectorIndexConfig;
exports.deserializeVectorIndex = deserializeVectorIndex;
const constants_js_1 = require("../constants.js");
const errors_js_1 = require("../errors.js");
const vector_js_1 = require("./vector.js");
function createFactory(kind, create, fromJSON) {
    return Object.assign(create, { kind, fromJSON });
}
function createFlatVectorIndexFactory() {
    return createFactory('flat', (ctx) => new vector_js_1.VectorIndex(ctx.dim), (json) => vector_js_1.VectorIndex.fromJSON(json));
}
exports.defaultFlatVectorIndexFactory = createFlatVectorIndexFactory();
function resolveVectorIndexFactory(property, indexes) {
    if (!indexes) {
        return exports.defaultFlatVectorIndexFactory;
    }
    const propertyConfig = property === constants_js_1.RESERVED_VECTOR_INDEX_KEY ? undefined : indexes[property];
    if (propertyConfig !== undefined) {
        return resolveVectorIndexConfig(propertyConfig);
    }
    const defaultConfig = indexes[constants_js_1.RESERVED_VECTOR_INDEX_KEY];
    if (defaultConfig !== undefined) {
        return resolveVectorIndexConfig(defaultConfig);
    }
    return exports.defaultFlatVectorIndexFactory;
}
function resolveVectorIndexConfig(config) {
    if (config === 'flat') {
        return exports.defaultFlatVectorIndexFactory;
    }
    return config;
}
function deserializeVectorIndex(property, raw, indexes) {
    const payload = raw;
    const kind = payload.kind ?? 'flat';
    const factory = resolveVectorIndexFactory(property, indexes);
    if (kind === 'ivf' && factory.kind !== 'ivf') {
        throw (0, errors_js_1.createError)('IVF_INDEX_REQUIRES_FACTORY', property, property);
    }
    return factory.fromJSON(raw);
}
//# sourceMappingURL=vector-index.js.map