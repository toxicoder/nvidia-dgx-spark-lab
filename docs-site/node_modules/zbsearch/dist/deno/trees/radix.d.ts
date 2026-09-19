import { InternalDocumentID } from '../components/internal-document-id-store.js';
import { PostingsMap, SerializedPostings } from './postings.js';
interface FindParams {
    term: string;
    exact?: boolean;
    tolerance?: number;
}
export type FindResult = Record<string, InternalDocumentID[]>;
export type RadixNodeJSON = {
    w: string;
    s: string;
    e: boolean;
    k: string;
    c: [string, RadixNodeJSON][];
    postings?: SerializedPostings;
    d?: InternalDocumentID[];
};
export declare class RadixNode {
    k: string;
    s: string;
    c: Map<string, RadixNode>;
    e: boolean;
    w: string;
    d?: InternalDocumentID[];
    constructor(key: string, subWord: string, end: boolean);
    updateParent(parent: RadixNode): void;
    protected addDocumentToPostings(postings: PostingsMap, docID: InternalDocumentID): void;
    protected removeDocumentFromPostings(postings: PostingsMap, docID: InternalDocumentID): boolean;
    protected getDocumentsFromPostings(postings: PostingsMap): InternalDocumentID[];
    protected hasDocumentsInPostings(postings: PostingsMap): boolean;
    findAllWords(output: FindResult, term: string, postings: PostingsMap, exact?: boolean, tolerance?: number): FindResult;
    insertWithPostings(word: string, docId: InternalDocumentID, postings: PostingsMap): void;
    private _findLevenshtein;
    findWithPostings(params: FindParams, postings: PostingsMap): FindResult;
    contains(term: string): boolean;
    removeWordWithPostings(term: string, postings: PostingsMap): boolean;
    removeDocumentByWordWithPostings(term: string, docID: InternalDocumentID, postings: PostingsMap, exact?: boolean): boolean;
    protected toNodeJSON(): RadixNodeJSON;
    static fromNodeJSON(json: RadixNodeJSON): RadixNode;
}
export declare class RadixTree extends RadixNode {
    postings: PostingsMap;
    constructor();
    insert(word: string, docId: InternalDocumentID): void;
    find(params: FindParams): FindResult;
    removeWord(term: string): boolean;
    removeDocumentByWord(term: string, docID: InternalDocumentID, exact?: boolean): boolean;
    getDocumentFrequency(term: string): number;
    toJSON(): RadixNodeJSON;
    static fromJSON(json: RadixNodeJSON): RadixTree;
}
export {};
