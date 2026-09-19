import { createBuilder } from "./build.js";
import { watch } from "node:fs";
import { join } from "node:path";

//#region src/next.ts
const withCn = (nextConfig = {}, options = {}) => {
	return async (phase, context) => {
		const builder = createBuilder(options);
		await builder.run();
		if (phase === "phase-development-server") {
			const cwd = options.cwd ?? process.cwd();
			const report = (err) => console.error(`cn: ${err instanceof Error ? err.message : err}`);
			watch(cwd, {
				recursive: true,
				persistent: false
			}, (_event, filename) => {
				if (filename) builder.changed(join(cwd, filename)).catch(report);
			});
		}
		return typeof nextConfig === "function" ? nextConfig(phase, context) : nextConfig;
	};
};

//#endregion
export { withCn };