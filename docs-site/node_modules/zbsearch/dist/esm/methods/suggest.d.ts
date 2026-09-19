import type { AnyZBSearch, SuggestParams, SuggestResults } from '../types.js';
/**
 * Returns the ranked query completions for a partially typed term, to build an autocomplete
 * dropdown without having to dedupe and rank the terms of full search results.
 *
 * Suggestions are indexed words, so they go through the same text analysis as the documents:
 * with a stemmer configured, the suggested words are stems.
 *
 * @example
 * const result = suggest(db, { term: 'noise can' })
 *
 * // {
 * //   elapsed: { raw: 181208, formatted: '181μs' },
 * //   count: 2,
 * //   suggestions: [
 * //     { suggestion: 'noise cancelling', terms: ['noise', 'cancelling'], score: 4.2, count: 3 },
 * //     { suggestion: 'noise cancellation', terms: ['noise', 'cancellation'], score: 1.1, count: 1 }
 * //   ]
 * // }
 */
export declare function suggest<T extends AnyZBSearch>(zbsearch: T, params: SuggestParams<T>, language?: string): SuggestResults;
/**
 * Alias of {@link suggest}, for familiarity with other search engines.
 */
export declare const autoSuggest: typeof suggest;
