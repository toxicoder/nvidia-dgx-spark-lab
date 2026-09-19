import { Language } from '../index.js';
import { AnyZBSearch } from '../types.js';
export interface RawData {
    internalDocumentIDStore: unknown;
    index: unknown;
    docs: unknown;
    sorting: unknown;
    pinning: unknown;
    language: Language;
}
export declare const CHUNKED_FORMAT_VERSION = 2;
export declare const DEFAULT_CHUNK_SIZE: number;
export interface ChunkedRawData {
    version: number;
    chunks: string[];
}
export type SaveFormat = 'default' | 'chunked';
export type SaveOptions = {
    format?: SaveFormat;
    chunkSize?: number;
};
export declare function isChunkedRawData(data: RawData | ChunkedRawData): data is ChunkedRawData;
export declare function toChunkedRawData(raw: RawData, chunkSize?: number): ChunkedRawData;
export declare function stringifyChunked(data: ChunkedRawData): string;
export declare function parseChunked(text: string): ChunkedRawData;
export declare function fromChunkedRawData(data: ChunkedRawData): RawData;
export declare function fromChunkedRawDataAsync(data: ChunkedRawData): Promise<RawData>;
export declare function load<T extends AnyZBSearch>(zbsearch: T, raw: RawData | ChunkedRawData): void;
export declare function loadAsync<T extends AnyZBSearch>(zbsearch: T, raw: RawData | ChunkedRawData): Promise<void>;
export declare function save<T extends AnyZBSearch>(zbsearch: T): RawData;
export declare function save<T extends AnyZBSearch>(zbsearch: T, options: SaveOptions & {
    format: 'chunked';
}): ChunkedRawData;
export declare function save<T extends AnyZBSearch>(zbsearch: T, options?: SaveOptions): RawData | ChunkedRawData;
