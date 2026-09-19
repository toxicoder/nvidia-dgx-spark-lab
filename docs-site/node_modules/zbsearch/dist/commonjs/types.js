"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kRemovals = exports.kInsertions = exports.RESERVED_VECTOR_INDEX_KEY = exports.MODE_VECTOR_SEARCH = exports.MODE_HYBRID_SEARCH = exports.MODE_FULLTEXT_SEARCH = void 0;
const constants_js_1 = require("./constants.js");
var constants_js_2 = require("./constants.js");
Object.defineProperty(exports, "MODE_FULLTEXT_SEARCH", { enumerable: true, get: function () { return constants_js_2.MODE_FULLTEXT_SEARCH; } });
Object.defineProperty(exports, "MODE_HYBRID_SEARCH", { enumerable: true, get: function () { return constants_js_2.MODE_HYBRID_SEARCH; } });
Object.defineProperty(exports, "MODE_VECTOR_SEARCH", { enumerable: true, get: function () { return constants_js_2.MODE_VECTOR_SEARCH; } });
Object.defineProperty(exports, "RESERVED_VECTOR_INDEX_KEY", { enumerable: true, get: function () { return constants_js_2.RESERVED_VECTOR_INDEX_KEY; } });
exports.kInsertions = Symbol('zbsearch.insertions');
exports.kRemovals = Symbol('zbsearch.removals');
//# sourceMappingURL=types.js.map