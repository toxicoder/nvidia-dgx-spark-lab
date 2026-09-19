//#region src/plugins/last-modified.ts
/**
* Enable the `lastModified` option on doc collections.
*
* This is a shorthand for setting `lastModified` on each collection, collections that set it
* themselves are left untouched.
*/
function lastModified(options = {}) {
	const { versionControl = "git", filter = () => true } = options;
	return {
		name: "last-modified",
		config(config) {
			for (const collection of config.collections.values()) {
				if (!filter(collection.name)) continue;
				const docs = collection.type === "doc" ? collection : collection.type === "docs" ? collection.docs : void 0;
				if (docs) docs.lastModified ??= versionControl === "git" ? true : versionControl;
			}
		}
	};
}
//#endregion
export { lastModified as default };
