import { InternalDocumentID } from '../components/internal-document-id-store.js';
export type PostingsMap = Map<string, InternalDocumentID[]>;
export declare function createPostingsMap(): PostingsMap;
export declare function getPostings(postings: PostingsMap, word: string): InternalDocumentID[];
export declare function addPosting(postings: PostingsMap, word: string, docId: InternalDocumentID): void;
export declare function appendPosting(postings: PostingsMap, word: string, docId: InternalDocumentID): void;
export declare function removePosting(postings: PostingsMap, word: string, docId: InternalDocumentID): boolean;
export declare function clearPostings(postings: PostingsMap, word: string): void;
export declare function getDocumentFrequency(postings: PostingsMap, word: string): number;
/** Delta-encode sorted doc IDs for compact storage. */
export declare function encodePostings(ids: InternalDocumentID[]): number[];
export declare function decodePostings(encoded: number[]): InternalDocumentID[];
export type SerializedPostings = Record<string, number[]>;
export declare function serializePostingsMap(postings: PostingsMap): SerializedPostings;
export declare function deserializePostingsMap(data: SerializedPostings | undefined): PostingsMap;
/** Collect doc IDs stored on legacy radix nodes (`d` arrays). */
export declare function collectLegacyNodePostings(nodeJson: {
    w?: string;
    e?: boolean;
    d?: InternalDocumentID[];
    c?: [string, unknown][];
}, postings: PostingsMap): void;
