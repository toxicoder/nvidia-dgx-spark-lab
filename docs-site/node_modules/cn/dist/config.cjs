Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_compiler = require('./compiler2.cjs');
const require_config = require('./config2.cjs');

exports.createCn = require_config.createCn;
exports.createTwMerge = require_config.createTwMerge;
exports.defaultConfig = require_config.getDefaultCnConfig;
exports.extendTailwindMerge = require_config.extendTailwindMerge;
exports.fromTheme = require_config.fromTheme;
exports.mergeConfigs = require_compiler.mergeConfigs;
exports.validators = require_config.validators;