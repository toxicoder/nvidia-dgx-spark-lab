import { isAsyncFunction } from "../utils.js";
export const OBJECT_COMPONENTS = [
	"tokenizer",
	"index",
	"documentsStore",
	"sorter",
	"pinning"
];
export const FUNCTION_COMPONENTS = [
	"validateSchema",
	"getDocumentIndexId",
	"getDocumentProperties",
	"formatElapsedTime"
];
export const SINGLE_OR_ARRAY_COMPONENTS = [];
export function runSingleHook(hooks, zbsearch, id, doc) {
	if (!hooks.length) {
		return;
	}
	const needAsync = hooks.some(isAsyncFunction);
	if (needAsync) {
		return (async () => {
			for (const hook of hooks) {
				await hook(zbsearch, id, doc);
			}
		})();
	} else {
		for (const hook of hooks) {
			hook(zbsearch, id, doc);
		}
	}
}
export function runMultipleHook(hooks, zbsearch, docsOrIds) {
	if (!hooks.length) {
		return;
	}
	const needAsync = hooks.some(isAsyncFunction);
	if (needAsync) {
		return (async () => {
			for (const hook of hooks) {
				await hook(zbsearch, docsOrIds);
			}
		})();
	} else {
		for (const hook of hooks) {
			hook(zbsearch, docsOrIds);
		}
	}
}
export function runAfterSearch(hooks, db, params, language, results) {
	const needAsync = hooks.some(isAsyncFunction);
	if (needAsync) {
		return (async () => {
			for (const hook of hooks) {
				await hook(db, params, language, results);
			}
		})();
	} else {
		for (const hook of hooks) {
			hook(db, params, language, results);
		}
	}
}
export function runBeforeSearch(hooks, db, params, language) {
	const needAsync = hooks.some(isAsyncFunction);
	if (needAsync) {
		return (async () => {
			for (const hook of hooks) {
				await hook(db, params, language);
			}
		})();
	} else {
		for (const hook of hooks) {
			hook(db, params, language);
		}
	}
}
export function runAfterCreate(hooks, db) {
	const needAsync = hooks.some(isAsyncFunction);
	if (needAsync) {
		return (async () => {
			for (const hook of hooks) {
				await hook(db);
			}
		})();
	} else {
		for (const hook of hooks) {
			hook(db);
		}
	}
}

//# sourceMappingURL=hooks.js.map
