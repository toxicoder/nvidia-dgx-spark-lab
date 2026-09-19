"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IVFVectorIndex = void 0;
exports.ivf = ivf;
const vector_math_js_1 = require("./vector-math.js");
const vector_js_1 = require("./vector.js");
function removeFromList(list, id) {
    const index = list.indexOf(id);
    if (index === -1) {
        return;
    }
    const lastIndex = list.length - 1;
    if (index !== lastIndex) {
        list[index] = list[lastIndex];
    }
    list.pop();
}
function initializeCentroids(vectors, nlist, dim) {
    const centroids = Array.from({ length: nlist }, () => new Float32Array(dim));
    const count = vectors.length;
    if (count === 0) {
        return centroids;
    }
    centroids[0] = new Float32Array(vectors[Math.floor(Math.random() * count)]);
    (0, vector_math_js_1.normalizeVector)(centroids[0], dim);
    const distances = new Float32Array(count);
    for (let c = 1; c < nlist; c++) {
        let distanceSum = 0;
        for (let i = 0; i < count; i++) {
            let minDistance = Infinity;
            for (let j = 0; j < c; j++) {
                const similarity = (0, vector_math_js_1.dotProduct)(vectors[i], centroids[j], dim);
                const distance = 1 - similarity;
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            distances[i] = minDistance;
            distanceSum += minDistance;
        }
        let threshold = Math.random() * distanceSum;
        let chosen = count - 1;
        for (let i = 0; i < count; i++) {
            threshold -= distances[i];
            if (threshold <= 0) {
                chosen = i;
                break;
            }
        }
        centroids[c] = new Float32Array(vectors[chosen]);
        (0, vector_math_js_1.normalizeVector)(centroids[c], dim);
    }
    return centroids;
}
function trainCentroids(vectors, nlist, dim) {
    const count = vectors.length;
    const centroids = initializeCentroids(vectors, nlist, dim);
    const assignments = new Uint32Array(count);
    for (let iter = 0; iter < 20; iter++) {
        let changed = false;
        for (let i = 0; i < count; i++) {
            const cluster = (0, vector_math_js_1.nearestCentroidIndex)(vectors[i], centroids, dim);
            if (assignments[i] !== cluster) {
                assignments[i] = cluster;
                changed = true;
            }
        }
        if (!changed) {
            break;
        }
        const counts = new Array(nlist).fill(0);
        const sums = Array.from({ length: nlist }, () => new Float32Array(dim));
        for (let i = 0; i < count; i++) {
            const cluster = assignments[i];
            counts[cluster]++;
            const vector = vectors[i];
            const sum = sums[cluster];
            for (let d = 0; d < dim; d++) {
                sum[d] += vector[d];
            }
        }
        for (let c = 0; c < nlist; c++) {
            if (counts[c] === 0) {
                continue;
            }
            const inv = 1 / counts[c];
            const centroid = centroids[c];
            const sum = sums[c];
            for (let d = 0; d < dim; d++) {
                centroid[d] = sum[d] * inv;
            }
            (0, vector_math_js_1.normalizeVector)(centroid, dim);
        }
    }
    return centroids;
}
function getProbeCentroids(queryVector, centroids, nprobe, dim) {
    const scores = centroids.map((centroid, index) => [index, (0, vector_math_js_1.dotProduct)(queryVector, centroid, dim)]);
    scores.sort((a, b) => b[1] - a[1]);
    return scores.slice(0, Math.min(nprobe, scores.length)).map(([index]) => index);
}
class IVFVectorIndex {
    size;
    nlist;
    nprobe;
    trainMin;
    vectors = new Map();
    lists = [];
    idToCluster = new Map();
    centroids = [];
    trained = false;
    constructor(size, nlist, nprobe, trainMin) {
        this.size = size;
        this.nlist = nlist;
        this.nprobe = nprobe;
        this.trainMin = trainMin;
        this.lists = Array.from({ length: nlist }, () => []);
    }
    add(internalDocumentId, value) {
        const stored = new Float32Array(value);
        (0, vector_math_js_1.normalizeVector)(stored, this.size);
        const previousCluster = this.idToCluster.get(internalDocumentId);
        if (previousCluster !== undefined) {
            removeFromList(this.lists[previousCluster], internalDocumentId);
        }
        this.vectors.set(internalDocumentId, stored);
        if (!this.trained) {
            if (this.vectors.size >= this.trainMin) {
                this.train();
            }
            return;
        }
        const cluster = (0, vector_math_js_1.nearestCentroidIndex)(stored, this.centroids, this.size);
        this.idToCluster.set(internalDocumentId, cluster);
        this.lists[cluster].push(internalDocumentId);
    }
    remove(internalDocumentId) {
        const cluster = this.idToCluster.get(internalDocumentId);
        if (cluster !== undefined) {
            removeFromList(this.lists[cluster], internalDocumentId);
            this.idToCluster.delete(internalDocumentId);
        }
        this.vectors.delete(internalDocumentId);
    }
    find(vector, similarity, whereFiltersIDs) {
        const queryVector = new Float32Array(vector);
        if ((0, vector_math_js_1.normalizeVector)(queryVector, this.size) === 0) {
            return [];
        }
        if (!this.trained) {
            const bruteForceVectors = new Map();
            for (const [id, stored] of this.vectors) {
                bruteForceVectors.set(id, [1, stored]);
            }
            return (0, vector_js_1.findSimilarVectors)(queryVector, whereFiltersIDs, bruteForceVectors, this.size, similarity);
        }
        const probeCentroids = getProbeCentroids(queryVector, this.centroids, this.nprobe, this.size);
        const candidateIds = new Set();
        for (const cluster of probeCentroids) {
            const list = this.lists[cluster];
            for (let i = 0; i < list.length; i++) {
                const id = list[i];
                if (!whereFiltersIDs || whereFiltersIDs.has(id)) {
                    candidateIds.add(id);
                }
            }
        }
        const candidateVectors = new Map();
        for (const id of candidateIds) {
            const stored = this.vectors.get(id);
            if (stored) {
                candidateVectors.set(id, [1, stored]);
            }
        }
        return (0, vector_js_1.findSimilarVectors)(queryVector, undefined, candidateVectors, this.size, similarity);
    }
    train() {
        const entries = Array.from(this.vectors.entries());
        const vectors = entries.map(([, vector]) => vector);
        this.centroids = trainCentroids(vectors, this.nlist, this.size);
        for (let i = 0; i < this.nlist; i++) {
            this.lists[i] = [];
        }
        this.idToCluster.clear();
        for (const [id, vector] of entries) {
            const cluster = (0, vector_math_js_1.nearestCentroidIndex)(vector, this.centroids, this.size);
            this.idToCluster.set(id, cluster);
            this.lists[cluster].push(id);
        }
        this.trained = true;
    }
    toJSON() {
        const vectors = [];
        for (const [id, vector] of this.vectors) {
            vectors.push([id, Array.from(vector)]);
        }
        return {
            kind: 'ivf',
            size: this.size,
            nlist: this.nlist,
            nprobe: this.nprobe,
            trainMin: this.trainMin,
            trained: this.trained,
            centroids: this.centroids.map((centroid) => Array.from(centroid)),
            lists: this.lists.map((list) => [...list]),
            vectors
        };
    }
    static fromJSON(json) {
        const raw = json;
        const index = new IVFVectorIndex(raw.size, raw.nlist, raw.nprobe, raw.trainMin);
        index.trained = raw.trained;
        index.centroids = raw.centroids.map((centroid) => {
            const stored = new Float32Array(centroid);
            (0, vector_math_js_1.normalizeVector)(stored, raw.size);
            return stored;
        });
        index.lists = raw.lists.map((list) => [...list]);
        for (const [id, vector] of raw.vectors) {
            const stored = new Float32Array(vector);
            (0, vector_math_js_1.normalizeVector)(stored, raw.size);
            index.vectors.set(id, stored);
            if (raw.trained && index.centroids.length > 0) {
                index.idToCluster.set(id, (0, vector_math_js_1.nearestCentroidIndex)(stored, index.centroids, raw.size));
            }
        }
        return index;
    }
}
exports.IVFVectorIndex = IVFVectorIndex;
function ivf(options = {}) {
    return Object.assign((ctx) => {
        const dim = options.dim ?? ctx.dim;
        const nlist = options.nlist ?? 64;
        const nprobe = options.nprobe ?? Math.max(1, Math.min(32, Math.floor(nlist / 4)));
        const trainMin = options.trainMin ?? Math.min(nlist, 32);
        return new IVFVectorIndex(dim, nlist, nprobe, trainMin);
    }, {
        kind: 'ivf',
        fromJSON: IVFVectorIndex.fromJSON
    });
}
//# sourceMappingURL=vector-ivf.js.map