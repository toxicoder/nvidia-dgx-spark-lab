Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_build = require('./build.cjs');
let node_fs = require("node:fs");
let node_path = require("node:path");

//#region src/next.ts
const withCn = (nextConfig = {}, options = {}) => {
	return async (phase, context) => {
		const builder = require_build.createBuilder(options);
		await builder.run();
		if (phase === "phase-development-server") {
			const cwd = options.cwd ?? process.cwd();
			const report = (err) => console.error(`cn: ${err instanceof Error ? err.message : err}`);
			(0, node_fs.watch)(cwd, {
				recursive: true,
				persistent: false
			}, (_event, filename) => {
				if (filename) builder.changed((0, node_path.join)(cwd, filename)).catch(report);
			});
		}
		return typeof nextConfig === "function" ? nextConfig(phase, context) : nextConfig;
	};
};

//#endregion
exports.withCn = withCn;