import { getNanosecondsTime, formatNanoseconds, removeVectorsFromHits, sortTokenScorePredicate } from "../utils.js";
import { getFacets } from "../components/facets.js";
import { getGroups } from "../components/groups.js";
import { fetchDocuments } from "./fetch-documents.js";
import { innerFullTextSearch } from "./search-fulltext.js";
import { innerVectorSearch } from "./search-vector.js";
import { runAfterSearch, runBeforeSearch } from "../components/hooks.js";
import { applyPinningRules } from "../components/pinning-manager.js";
export function innerHybridSearch(zbsearch, params, language) {
	const hasFilters = Object.keys(params.where ?? {}).length > 0;
	let whereFiltersIDs;
	if (hasFilters) {
		whereFiltersIDs = zbsearch.index.searchByWhereClause(zbsearch.data.index, zbsearch.tokenizer, params.where, language);
	}
	const hasFullTextInput = Boolean(params.term) || Boolean(params.properties);
	const fullTextIDs = hasFullTextInput ? innerFullTextSearch(zbsearch, params, language, whereFiltersIDs) : [];
	const vectorIDs = innerVectorSearch(zbsearch, params, language, whereFiltersIDs);
	const hybridWeights = params.hybridWeights;
	return mergeAndRankResults(fullTextIDs, vectorIDs, params.term ?? "", hybridWeights);
}
export function hybridSearch(zbsearch, params, language) {
	const timeStart = getNanosecondsTime();
	function performSearchLogic() {
		let uniqueTokenScores = innerHybridSearch(zbsearch, params, language);
		// Apply pinning rules after merging results but before pagination
		uniqueTokenScores = applyPinningRules(zbsearch, zbsearch.data.pinning, uniqueTokenScores, params.term);
		let facetsResults;
		const shouldCalculateFacets = params.facets && Object.keys(params.facets).length > 0;
		if (shouldCalculateFacets) {
			facetsResults = getFacets(zbsearch, uniqueTokenScores, params.facets);
		}
		let groups;
		if (params.groupBy) {
			groups = getGroups(zbsearch, uniqueTokenScores, params.groupBy);
		}
		const offset = params.offset ?? 0;
		const limit = params.limit ?? 10;
		const results = fetchDocuments(zbsearch, uniqueTokenScores, offset, limit).filter(Boolean);
		const timeEnd = getNanosecondsTime();
		const returningResults = {
			count: uniqueTokenScores.length,
			elapsed: {
				raw: Number(timeEnd - timeStart),
				formatted: formatNanoseconds(timeEnd - timeStart)
			},
			hits: results,
			...facetsResults ? { facets: facetsResults } : {},
			...groups ? { groups } : {}
		};
		const includeVectors = params.includeVectors ?? false;
		if (!includeVectors) {
			const vectorProperties = Object.keys(zbsearch.data.index.vectorIndexes);
			removeVectorsFromHits(returningResults, vectorProperties);
		}
		return returningResults;
	}
	async function executeSearchAsync() {
		if (zbsearch.beforeSearch) {
			await runBeforeSearch(zbsearch.beforeSearch, zbsearch, params, language);
		}
		const results = performSearchLogic();
		if (zbsearch.afterSearch) {
			await runAfterSearch(zbsearch.afterSearch, zbsearch, params, language, results);
		}
		return results;
	}
	const asyncNeeded = zbsearch.beforeSearch?.length || zbsearch.afterSearch?.length;
	if (asyncNeeded) {
		return executeSearchAsync();
	}
	return performSearchLogic();
}
function getMaxScore(results) {
	let max = 0;
	const resultsLength = results.length;
	for (let i = 0; i < resultsLength; i++) {
		const score = results[i][1];
		if (score > max) {
			max = score;
		}
	}
	return max;
}
function normalizeScore(score, maxScore) {
	return maxScore > 0 ? score / maxScore : 0;
}
function hybridScoreBuilder(textWeight, vectorWeight) {
	return (textScore, vectorScore) => textScore * textWeight + vectorScore * vectorWeight;
}
function mergeAndRankResults(textResults, vectorResults, query, hybridWeights) {
	// Avoid Math.max(...results): spreading large result sets overflows the call stack.
	const maxTextScore = getMaxScore(textResults);
	const maxVectorScore = getMaxScore(vectorResults);
	const hasHybridWeights = hybridWeights && typeof hybridWeights.text === "number" && typeof hybridWeights.vector === "number";
	const { text: textWeight, vector: vectorWeight } = hasHybridWeights ? hybridWeights : getQueryWeights(query);
	const mergedResults = new Map();
	const textResultsLength = textResults.length;
	const hybridScore = hybridScoreBuilder(textWeight, vectorWeight);
	for (let i = 0; i < textResultsLength; i++) {
		const [id, score] = textResults[i];
		const normalizedScore = normalizeScore(score, maxTextScore);
		const hybridScoreValue = hybridScore(normalizedScore, 0);
		mergedResults.set(id, hybridScoreValue);
	}
	const vectorResultsLength = vectorResults.length;
	for (let i = 0; i < vectorResultsLength; i++) {
		const [resultId, score] = vectorResults[i];
		const normalizedScore = normalizeScore(score, maxVectorScore);
		const existingRes = mergedResults.get(resultId) ?? 0;
		mergedResults.set(resultId, existingRes + hybridScore(0, normalizedScore));
	}
	return [...mergedResults].sort(sortTokenScorePredicate);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getQueryWeights(query) {
	// In the next versions of ZBSearch, we will ship a plugin containing a ML model to adjust the weights
	// based on whether the query is keyword-focused, conceptual, etc.
	// For now, we just return a fixed value.
	return {
		text: .5,
		vector: .5
	};
}

//# sourceMappingURL=search-hybrid.js.map
