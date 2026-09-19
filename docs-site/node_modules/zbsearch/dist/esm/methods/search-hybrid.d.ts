import type { AnyZBSearch, TypedDocument, SearchParamsHybrid, Results, TokenScore } from '../types.js';
export declare function innerHybridSearch<T extends AnyZBSearch, ResultDocument = TypedDocument<T>>(zbsearch: T, params: SearchParamsHybrid<T, ResultDocument>, language?: string): TokenScore[];
export declare function hybridSearch<T extends AnyZBSearch, ResultDocument = TypedDocument<T>>(zbsearch: T, params: SearchParamsHybrid<T, ResultDocument>, language?: string): Results<ResultDocument> | Promise<Results<ResultDocument>>;
