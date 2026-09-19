Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_build = require('./build.cjs');

//#region src/vite.ts
const cn = (options = {}) => {
	let builder = null;
	return {
		name: "cn:build",
		configResolved(config) {
			builder = require_build.createBuilder({
				cwd: config.root,
				...options
			});
		},
		async buildStart() {
			builder ??= require_build.createBuilder(options);
			await builder.run();
		},
		async watchChange(id, change) {
			if (change.event === "delete" || !builder) return;
			await builder.changed(id);
		}
	};
};

//#endregion
exports.cn = cn;