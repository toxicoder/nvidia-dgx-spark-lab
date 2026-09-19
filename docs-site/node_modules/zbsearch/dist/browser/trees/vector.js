import { dotProduct, normalizeVector } from "./vector-math.js";
export const DEFAULT_SIMILARITY = .8;
export { getMagnitude, normalizeVector, dotProduct } from "./vector-math.js";
export class VectorIndex {
	size;
	vectors = new Map();
	constructor(size) {
		this.size = size;
	}
	add(internalDocumentId, value) {
		const stored = new Float32Array(value);
		normalizeVector(stored, this.size);
		this.vectors.set(internalDocumentId, [1, stored]);
	}
	remove(internalDocumentId) {
		this.vectors.delete(internalDocumentId);
	}
	find(vector, similarity, whereFiltersIDs) {
		const queryVector = new Float32Array(vector);
		if (normalizeVector(queryVector, this.size) === 0) {
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
			kind: "flat",
			size: this.size,
			vectors
		};
	}
	static fromJSON(json) {
		const raw = json;
		const index = new VectorIndex(raw.size);
		for (const [id, [, vector]] of raw.vectors) {
			const stored = new Float32Array(vector);
			normalizeVector(stored, raw.size);
			index.vectors.set(id, [1, stored]);
		}
		return index;
	}
}
export function flat() {
	return Object.assign((ctx) => new VectorIndex(ctx.dim), {
		kind: "flat",
		fromJSON: VectorIndex.fromJSON
	});
}
// @todo: Write plugins for Node and Browsers to use parallel computation for this function
export function findSimilarVectors(targetVector, keys, vectors, length, threshold) {
	const similarVectors = [];
	if (keys) {
		for (const vectorId of keys) {
			const entry = vectors.get(vectorId);
			if (!entry) {
				continue;
			}
			const score = dotProduct(targetVector, entry[1], length);
			if (score >= threshold) {
				similarVectors.push([vectorId, score]);
			}
		}
		return similarVectors;
	}
	for (const [vectorId, [, vector]] of vectors) {
		const score = dotProduct(targetVector, vector, length);
		if (score >= threshold) {
			similarVectors.push([vectorId, score]);
		}
	}
	return similarVectors;
}

//# sourceMappingURL=vector.js.map
