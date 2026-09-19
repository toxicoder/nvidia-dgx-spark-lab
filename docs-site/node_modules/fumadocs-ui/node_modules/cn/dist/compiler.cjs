Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_compiler = require('./compiler2.cjs');

exports.compileModel = require_compiler.compileModel;
exports.compileStats = require_compiler.compileStats;
exports.compileToSource = require_compiler.compileToSource;
exports.compileToTables = require_compiler.compileToTables;
exports.mergeConfigs = require_compiler.mergeConfigs;
exports.subsetConfig = require_compiler.subsetConfig;