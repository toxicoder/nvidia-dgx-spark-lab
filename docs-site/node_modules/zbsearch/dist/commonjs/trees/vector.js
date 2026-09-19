"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorIndex = exports.dotProduct = exports.normalizeVector = exports.getMagnitude = exports.DEFAULT_SIMILARITY = void 0;
exports.flat = flat;
exports.findSimilarVectors = findSimilarVectors;
const vector_math_js_1 = require("./vector-math.js");
exports.DEFAULT_SIMILARITY = 0.8;
var vector_math_js_2 = require("./vector-math.js");
Object.defineProperty(exports, "getMagnitude", { enumerable: true, get: function () { return vector_math_js_2.getMagnitude; } });
Object.defineProperty(exports, "normalizeVector", { enumerable: true, get: function () { return vector_math_js_2.normalizeVector; } });
Object.defineProperty(exports, "dotProduct", { enumerable: true, get: function () { return vector_math_js_2.dotProduct; } });
class VectorIndex {
    size;
    vectors = new Map();
    constructor(size) {
        this.size = size;
    }
    add(internalDocumentId, value) {
        const stored = new Float32Array(value);
        (0, vector_math_js_1.normalizeVector)(stored, this.size);
        this.vectors.set(internalDocumentId, [1, stored]);
    }
    remove(internalDocumentId) {
        this.vectors.delete(internalDocumentId);
    }
    find(vector, similarity, whereFiltersIDs) {
        const queryVector = new Float32Array(vector);
        if ((0, vector_math_js_1.normalizeVector)(queryVector, this.size) === 0) {
            return [];
        }
        return findSimilarVectors(queryVector, whereFiltersIDs, this.vectors, this.size, similarity);
    }
    toJSON() {
        const vectors = [];
        for (const [id, [magnitude, vector]] of this.vectors) {
            vectors.push([id, [magnitude, Array.from(vector)]]);
        }
        return {
            kind: 'flat',
            size: this.size,
            vectors
        };
    }
    static fromJSON(json) {
        const raw = json;
        const index = new VectorIndex(raw.size);
        for (const [id, [, vector]] of raw.vectors) {
            const stored = new Float32Array(vector);
            (0, vector_math_js_1.normalizeVector)(stored, raw.size);
            index.vectors.set(id, [1, stored]);
        }
        return index;
    }
}
exports.VectorIndex = VectorIndex;
function flat() {
    return Object.assign((ctx) => new VectorIndex(ctx.dim), {
        kind: 'flat',
        fromJSON: VectorIndex.fromJSON
    });
}
// @todo: Write plugins for Node and Browsers to use parallel computation for this function
function findSimilarVectors(targetVector, keys, vectors, length, threshold) {
    const similarVectors = [];
    if (keys) {
        for (const vectorId of keys) {
            const entry = vectors.get(vectorId);
            if (!entry) {
                continue;
            }
            const score = (0, vector_math_js_1.dotProduct)(targetVector, entry[1], length);
            if (score >= threshold) {
                similarVectors.push([vectorId, score]);
            }
        }
        return similarVectors;
    }
    for (const [vectorId, [, vector]] of vectors) {
        const score = (0, vector_math_js_1.dotProduct)(targetVector, vector, length);
        if (score >= threshold) {
            similarVectors.push([vectorId, score]);
        }
    }
    return similarVectors;
}
//# sourceMappingURL=vector.js.map