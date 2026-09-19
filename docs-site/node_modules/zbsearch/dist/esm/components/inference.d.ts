import type { AnyDocument, AnyZBSearch } from '../types.js';
export declare function inferSchemaFromDocument<T extends AnyZBSearch>(zbsearch: T, doc: AnyDocument): boolean;
