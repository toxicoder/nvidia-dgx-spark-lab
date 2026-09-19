import type { InternalDocumentID } from '../components/internal-document-id-store.js';
import type { VectorIndexFactory, VectorIndexLike } from '../types.js';
import { type SimilarVector, type VectorTypeLike } from './vector.js';
export interface IvfOptions {
    dim?: number;
    nlist?: number;
    nprobe?: number;
    trainMin?: number;
}
interface IvfJSON {
    kind: 'ivf';
    size: number;
    nlist: number;
    nprobe: number;
    trainMin: number;
    trained: boolean;
    centroids: number[][];
    lists: InternalDocumentID[][];
    vectors: [InternalDocumentID, number[]][];
}
export declare class IVFVectorIndex implements VectorIndexLike {
    readonly size: number;
    readonly nlist: number;
    readonly nprobe: number;
    readonly trainMin: number;
    private vectors;
    private lists;
    private idToCluster;
    private centroids;
    private trained;
    constructor(size: number, nlist: number, nprobe: number, trainMin: number);
    add(internalDocumentId: InternalDocumentID, value: VectorTypeLike): void;
    remove(internalDocumentId: InternalDocumentID): void;
    find(vector: VectorTypeLike, similarity: number, whereFiltersIDs: Set<InternalDocumentID> | undefined): SimilarVector[];
    private train;
    toJSON(): IvfJSON;
    static fromJSON(json: unknown): IVFVectorIndex;
}
export declare function ivf(options?: IvfOptions): VectorIndexFactory;
export {};
