import { RESERVED_VECTOR_INDEX_KEY } from "../constants.js";
import { getNested } from "../utils.js";
import { addSearchablePropertyToIndex } from "./index.js";
import { addSortablePropertyToSorter } from "./sorter.js";
function inferTypeFromValue(value) {
	switch (typeof value) {
		case "string": return "string";
		case "number": return "number";
		case "boolean": return "boolean";
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return undefined;
		}
		const innerType = inferTypeFromValue(value[0]);
		if (innerType === "string" || innerType === "number" || innerType === "boolean") {
			return `${innerType}[]`;
		}
		return undefined;
	}
	// getDocumentProperties already treats any object with numeric lat/lon as a geopoint value, so inferring `geopoint` is the only consistent choice.
	if (typeof value === "object" && value !== null) {
		const point = value;
		if (typeof point.lat === "number" && typeof point.lon === "number") {
			return "geopoint";
		}
	}
	return undefined;
}
function flattenDocument(doc, prefix, leaves) {
	for (const [key, value] of Object.entries(doc)) {
		if (key === "id" || key === RESERVED_VECTOR_INDEX_KEY) {
			continue;
		}
		if (value === null || typeof value === "undefined") {
			continue;
		}
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "object" && !Array.isArray(value)) {
			if (typeof value.lat === "number" && typeof value.lon === "number") {
				leaves.push([path, value]);
				continue;
			}
			flattenDocument(value, path, leaves);
			continue;
		}
		leaves.push([path, value]);
	}
}
function hasPathConflict(knownProperties, path) {
	for (const known of Object.keys(knownProperties)) {
		if (path.startsWith(`${known}.`) || known.startsWith(`${path}.`)) {
			return true;
		}
	}
	return false;
}
function setNestedSchemaProperty(schema, path, type) {
	const tokens = path.split(".");
	const lastToken = tokens[tokens.length - 1];
	let current = schema;
	for (let i = 0; i < tokens.length - 1; i++) {
		const token = tokens[i];
		const next = current[token];
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			current[token] = {};
		}
		current = current[token];
	}
	current[lastToken] = type;
}
export function inferSchemaFromDocument(zbsearch, doc) {
	if (!zbsearch.inferSchema) {
		return false;
	}
	const leaves = [];
	flattenDocument(doc, "", leaves);
	const index = zbsearch.data.index;
	const sorter = zbsearch.data.sorting;
	const knownProperties = zbsearch.index.getSearchablePropertiesWithTypes(index);
	let changed = false;
	for (const [path, value] of leaves) {
		const knownType = knownProperties[path];
		if (knownType) {
			// The index already knows this property (e.g. after load()): make sure the runtime schema reflects its type so validateSchema keeps enforcing it.
			if (getNested(zbsearch.schema, path) !== knownType) {
				setNestedSchemaProperty(zbsearch.schema, path, knownType);
			}
			continue;
		}
		const type = inferTypeFromValue(value);
		if (!type) {
			continue;
		}
		if (hasPathConflict(knownProperties, path)) {
			// A known property is a prefix of this path (e.g. `a` scalar, new `a.b`) or the reverse: the document shape conflicts with the locked type of
			// the existing property. Skip registration and let validateSchema reject the document instead of corrupting the schema.
			continue;
		}
		addSearchablePropertyToIndex(zbsearch, index, path, type);
		addSortablePropertyToSorter(sorter, path, type);
		setNestedSchemaProperty(zbsearch.schema, path, type);
		knownProperties[path] = type;
		changed = true;
	}
	if (changed) {
		zbsearch.caches = {};
	}
	return changed;
}

//# sourceMappingURL=inference.js.map
