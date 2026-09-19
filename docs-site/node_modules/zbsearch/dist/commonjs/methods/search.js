"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = search;
const errors_js_1 = require("../errors.js");
const constants_js_1 = require("../constants.js");
const search_fulltext_js_1 = require("./search-fulltext.js");
const search_vector_js_1 = require("./search-vector.js");
const search_hybrid_js_1 = require("./search-hybrid.js");
function search(zbsearch, params, language) {
    const mode = params.mode ?? constants_js_1.MODE_FULLTEXT_SEARCH;
    if (mode === constants_js_1.MODE_FULLTEXT_SEARCH) {
        return (0, search_fulltext_js_1.fullTextSearch)(zbsearch, params, language);
    }
    if (mode === constants_js_1.MODE_VECTOR_SEARCH) {
        return (0, search_vector_js_1.searchVector)(zbsearch, params);
    }
    if (mode === constants_js_1.MODE_HYBRID_SEARCH) {
        return (0, search_hybrid_js_1.hybridSearch)(zbsearch, params);
    }
    throw (0, errors_js_1.createError)('INVALID_SEARCH_MODE', mode);
}
//# sourceMappingURL=search.js.map