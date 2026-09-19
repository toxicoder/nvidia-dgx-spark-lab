"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMagnitude = getMagnitude;
exports.normalizeVector = normalizeVector;
exports.dotProduct = dotProduct;
exports.nearestCentroidIndex = nearestCentroidIndex;
function getMagnitude(vector, vectorLength) {
    let magnitude = 0;
    for (let i = 0; i < vectorLength; i++) {
        magnitude += vector[i] * vector[i];
    }
    return Math.sqrt(magnitude);
}
function normalizeVector(vector, vectorLength) {
    let magnitudeSq = 0;
    for (let i = 0; i < vectorLength; i++) {
        magnitudeSq += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(magnitudeSq);
    if (magnitude === 0) {
        return 0;
    }
    const invMagnitude = 1 / magnitude;
    for (let i = 0; i < vectorLength; i++) {
        vector[i] *= invMagnitude;
    }
    return magnitude;
}
function dotProduct(targetVector, vector, length) {
    let sum = 0;
    let i = 0;
    const limit = length - 3;
    for (; i < limit; i += 4) {
        sum +=
            targetVector[i] * vector[i] +
                targetVector[i + 1] * vector[i + 1] +
                targetVector[i + 2] * vector[i + 2] +
                targetVector[i + 3] * vector[i + 3];
    }
    for (; i < length; i++) {
        sum += targetVector[i] * vector[i];
    }
    return sum > 1 ? 1 : sum < -1 ? -1 : sum;
}
function nearestCentroidIndex(vector, centroids, length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < centroids.length; i++) {
        const score = dotProduct(vector, centroids[i], length);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestIndex;
}
//# sourceMappingURL=vector-math.js.map