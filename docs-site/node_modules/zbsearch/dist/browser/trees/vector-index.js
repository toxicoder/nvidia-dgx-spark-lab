import { RESERVED_VECTOR_INDEX_KEY } from "../constants.js";
import { createError } from "../errors.js";
import { VectorIndex } from "./vector.js";
function createFactory(kind, create, fromJSON) {
	return Object.assign(create, {
		kind,
		fromJSON
	});
}
export function createFlatVectorIndexFactory() {
	return createFactory("flat", (ctx) => new VectorIndex(ctx.dim), (json) => VectorIndex.fromJSON(json));
}
export const defaultFlatVectorIndexFactory = createFlatVectorIndexFactory();
export function resolveVectorIndexFactory(property, indexes) {
	if (!indexes) {
		return defaultFlatVectorIndexFactory;
	}
	const propertyConfig = property === RESERVED_VECTOR_INDEX_KEY ? undefined : indexes[property];
	if (propertyConfig !== undefined) {
		return resolveVectorIndexConfig(propertyConfig);
	}
	const defaultConfig = indexes[RESERVED_VECTOR_INDEX_KEY];
	if (defaultConfig !== undefined) {
		return resolveVectorIndexConfig(defaultConfig);
	}
	return defaultFlatVectorIndexFactory;
}
export function resolveVectorIndexConfig(config) {
	if (config === "flat") {
		return defaultFlatVectorIndexFactory;
	}
	return config;
}
export function deserializeVectorIndex(property, raw, indexes) {
	const payload = raw;
	const kind = payload.kind ?? "flat";
	const factory = resolveVectorIndexFactory(property, indexes);
	if (kind === "ivf" && factory.kind !== "ivf") {
		throw createError("IVF_INDEX_REQUIRES_FACTORY", property, property);
	}
	return factory.fromJSON(raw);
}

//# sourceMappingURL=vector-index.js.map
