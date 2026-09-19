import { generateCodeBlockTabs } from "./codeblock-utils.js";
import { visit } from "unist-util-visit";
import convert from "npm-to-yarn";
//#region src/mdx-plugins/remark-npm.ts
function convertLines(cmd, to) {
	return cmd.split("\n").map((l) => convert(l, to)).join("\n");
}
/**
* It generates multiple tabs of codeblocks for different package managers from a npm command codeblock.
*/
function remarkNpm({ persist = false, packageManagers = [
	{
		command: (cmd) => cmd,
		name: "npm"
	},
	{
		command: (cmd) => convertLines(cmd, "pnpm"),
		name: "pnpm"
	},
	{
		command: (cmd) => convertLines(cmd, "yarn"),
		name: "yarn"
	},
	{
		command: (cmd) => convertLines(cmd, "bun"),
		name: "bun"
	}
] } = {}) {
	return (tree) => {
		visit(tree, "code", (node, idx, parent) => {
			if (typeof idx !== "number" || !parent) return;
			let code;
			switch (node.lang) {
				case "package-install":
					code = node.value;
					if (!code.startsWith("npm") && !code.startsWith("npx")) code = `npm install ${code}`;
					break;
				case "npm":
					code = node.value;
					break;
				default: return;
			}
			const options = {
				persist,
				tabs: [],
				triggers: []
			};
			for (const manager of packageManagers) {
				const value = manager.value ?? manager.name;
				const command = manager.command(code);
				if (!command || command.length === 0) continue;
				options.defaultValue ??= value;
				options.triggers.push({
					value,
					children: [{
						type: "text",
						value: manager.name
					}]
				});
				options.tabs.push({
					value,
					children: [{
						type: "code",
						lang: "bash",
						meta: node.meta,
						value: command
					}]
				});
			}
			parent.children[idx] = generateCodeBlockTabs(options);
			return "skip";
		});
	};
}
//#endregion
export { remarkNpm };
