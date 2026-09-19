import type { IndexesConfig, VectorIndexConfig, VectorIndexFactory } from '../types.js';
export declare function createFlatVectorIndexFactory(): VectorIndexFactory;
export declare const defaultFlatVectorIndexFactory: VectorIndexFactory;
export declare function resolveVectorIndexFactory(property: string, indexes?: IndexesConfig): VectorIndexFactory;
export declare function resolveVectorIndexConfig(config: VectorIndexConfig): VectorIndexFactory;
export declare function deserializeVectorIndex(property: string, raw: unknown, indexes?: IndexesConfig): ReturnType<VectorIndexFactory>;
