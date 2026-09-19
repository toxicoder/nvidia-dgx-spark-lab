import type { InternalDocumentID } from '../components/internal-document-id-store.js';
import type { VectorIndexFactory, VectorIndexLike } from '../types.js';
export type Magnitude = number;
export type VectorType = Float32Array;
export type VectorTypeLike = number[] | VectorType;
export type SimilarVector = [number, number];
export declare const DEFAULT_SIMILARITY = 0.8;
export { getMagnitude, normalizeVector, dotProduct } from './vector-math.js';
export declare class VectorIndex implements VectorIndexLike {
    size: number;
    private vectors;
    constructor(size: number);
    add(internalDocumentId: InternalDocumentID, value: VectorTypeLike): void;
    remove(internalDocumentId: InternalDocumentID): void;
    find(vector: VectorTypeLike, similarity: number, whereFiltersIDs: Set<InternalDocumentID> | undefined): SimilarVector[];
    toJSON(): {
        kind: 'flat';
        size: number;
        vectors: [InternalDocumentID, [Magnitude, number[]]][];
    };
    static fromJSON(json: unknown): VectorIndex;
}
export declare function flat(): VectorIndexFactory;
export declare function findSimilarVectors(targetVector: Float32Array, keys: Set<InternalDocumentID> | undefined, vectors: Map<InternalDocumentID, [Magnitude, VectorType]>, length: number, threshold: number): SimilarVector[];
