//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!no_symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};

//#endregion
//#region src/validators.ts
var validators_exports = /* @__PURE__ */ __exportAll({
	isAny: () => isAny,
	isAnyNonArbitrary: () => isAnyNonArbitrary,
	isArbitraryFamilyName: () => isArbitraryFamilyName,
	isArbitraryImage: () => isArbitraryImage,
	isArbitraryLength: () => isArbitraryLength,
	isArbitraryNumber: () => isArbitraryNumber,
	isArbitraryPosition: () => isArbitraryPosition,
	isArbitraryShadow: () => isArbitraryShadow,
	isArbitrarySize: () => isArbitrarySize,
	isArbitraryValue: () => isArbitraryValue,
	isArbitraryVariable: () => isArbitraryVariable,
	isArbitraryVariableFamilyName: () => isArbitraryVariableFamilyName,
	isArbitraryVariableImage: () => isArbitraryVariableImage,
	isArbitraryVariableLength: () => isArbitraryVariableLength,
	isArbitraryVariablePosition: () => isArbitraryVariablePosition,
	isArbitraryVariableShadow: () => isArbitraryVariableShadow,
	isArbitraryVariableSize: () => isArbitraryVariableSize,
	isArbitraryVariableWeight: () => isArbitraryVariableWeight,
	isArbitraryWeight: () => isArbitraryWeight,
	isFraction: () => isFraction,
	isInteger: () => isInteger,
	isNamedContainerQuery: () => isNamedContainerQuery,
	isNumber: () => isNumber,
	isPercent: () => isPercent,
	isTshirtSize: () => isTshirtSize
});
const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
const lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
const imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
const isFraction = (v) => fractionRegex.test(v);
const isNumber = (v) => !!v && !Number.isNaN(Number(v));
const isInteger = (v) => !!v && Number.isInteger(Number(v));
const isPercent = (v) => v.endsWith("%") && isNumber(v.slice(0, -1));
const isTshirtSize = (v) => tshirtUnitRegex.test(v);
const isAny = () => true;
const isLengthOnly = (v) => lengthUnitRegex.test(v) && !colorFunctionRegex.test(v);
const isNever = () => false;
const isShadow = (v) => shadowRegex.test(v);
const isImage = (v) => imageRegex.test(v);
const isAnyNonArbitrary = (v) => !isArbitraryValue(v) && !isArbitraryVariable(v);
const isNamedContainerQuery = (v) => v.startsWith("@container") && (v[10] === "/" && v[11] !== void 0 || v[11] === "s" && v[16] !== void 0 && v.startsWith("-size/", 10) || v[11] === "n" && v[18] !== void 0 && v.startsWith("-normal/", 10));
const getIsArbitraryValue = (value, testLabel, testValue) => {
	const result = arbitraryValueRegex.exec(value);
	if (result) {
		if (result[1]) return testLabel(result[1]);
		return testValue(result[2]);
	}
	return false;
};
const getIsArbitraryVariable = (value, testLabel, shouldMatchNoLabel = false) => {
	const result = arbitraryVariableRegex.exec(value);
	if (result) {
		if (result[1]) return testLabel(result[1]);
		return shouldMatchNoLabel;
	}
	return false;
};
const isLabelPosition = (l) => l === "position" || l === "percentage";
const isLabelImage = (l) => l === "image" || l === "url";
const isLabelSize = (l) => l === "length" || l === "size" || l === "bg-size";
const isLabelLength = (l) => l === "length";
const isLabelNumber = (l) => l === "number";
const isLabelFamilyName = (l) => l === "family-name";
const isLabelWeight = (l) => l === "number" || l === "weight";
const isLabelShadow = (l) => l === "shadow";
const isArbitrarySize = (v) => getIsArbitraryValue(v, isLabelSize, isNever);
const isArbitraryValue = (v) => arbitraryValueRegex.test(v);
const isArbitraryLength = (v) => getIsArbitraryValue(v, isLabelLength, isLengthOnly);
const isArbitraryNumber = (v) => getIsArbitraryValue(v, isLabelNumber, isNumber);
const isArbitraryWeight = (v) => getIsArbitraryValue(v, isLabelWeight, isAny);
const isArbitraryFamilyName = (v) => getIsArbitraryValue(v, isLabelFamilyName, isNever);
const isArbitraryPosition = (v) => getIsArbitraryValue(v, isLabelPosition, isNever);
const isArbitraryImage = (v) => getIsArbitraryValue(v, isLabelImage, isImage);
const isArbitraryShadow = (v) => getIsArbitraryValue(v, isLabelShadow, isShadow);
const isArbitraryVariable = (v) => arbitraryVariableRegex.test(v);
const isArbitraryVariableLength = (v) => getIsArbitraryVariable(v, isLabelLength);
const isArbitraryVariableFamilyName = (v) => getIsArbitraryVariable(v, isLabelFamilyName);
const isArbitraryVariablePosition = (v) => getIsArbitraryVariable(v, isLabelPosition);
const isArbitraryVariableSize = (v) => getIsArbitraryVariable(v, isLabelSize);
const isArbitraryVariableImage = (v) => getIsArbitraryVariable(v, isLabelImage);
const isArbitraryVariableShadow = (v) => getIsArbitraryVariable(v, isLabelShadow, true);
const isArbitraryVariableWeight = (v) => getIsArbitraryVariable(v, isLabelWeight, true);

//#endregion
//#region src/compiler.ts
const isMarker = (def, key) => {
	const keys = Object.keys(def);
	return keys.length === 1 && keys[0] === key && typeof def[key] === "string";
};
const isThemeGetterFn = (fn) => typeof fn === "function" && fn.isThemeGetter === true;
const cloneConfig = (config) => ({
	...config,
	theme: { ...config.theme },
	classGroups: { ...config.classGroups },
	conflictingClassGroups: { ...config.conflictingClassGroups },
	conflictingClassGroupModifiers: { ...config.conflictingClassGroupModifiers },
	orderSensitiveModifiers: [...config.orderSensitiveModifiers],
	postfixLookupClassGroups: [...config.postfixLookupClassGroups ?? []]
});
const mergeConfigs = (base, extension) => {
	const config = cloneConfig(base);
	if (extension.prefix !== void 0) config.prefix = extension.prefix;
	const overrideProps = (target, src) => {
		if (!src) return;
		for (const key in src) if (src[key] !== void 0) target[key] = src[key];
	};
	const ov = extension.override;
	if (ov) {
		if (ov.orderSensitiveModifiers) config.orderSensitiveModifiers = [...ov.orderSensitiveModifiers];
		overrideProps(config.theme, ov.theme);
		overrideProps(config.classGroups, ov.classGroups);
		overrideProps(config.conflictingClassGroups, ov.conflictingClassGroups);
		overrideProps(config.conflictingClassGroupModifiers, ov.conflictingClassGroupModifiers);
	}
	const extendArrays = (target, src) => {
		if (!src) return;
		for (const key in src) {
			const add = src[key];
			if (add) target[key] = (target[key] ?? []).concat(add);
		}
	};
	const ex = extension.extend;
	if (ex) {
		if (ex.orderSensitiveModifiers) config.orderSensitiveModifiers = [...config.orderSensitiveModifiers, ...ex.orderSensitiveModifiers];
		extendArrays(config.theme, ex.theme);
		extendArrays(config.classGroups, ex.classGroups);
		extendArrays(config.conflictingClassGroups, ex.conflictingClassGroups);
		extendArrays(config.conflictingClassGroupModifiers, ex.conflictingClassGroupModifiers);
	}
	return config;
};
const OPS = {
	isAny: 0,
	isAnyNonArbitrary: 1,
	isArbitraryValue: 2,
	isArbitraryVariable: 3,
	isFraction: 4,
	isNumber: 5,
	isInteger: 6,
	isPercent: 7,
	isTshirtSize: 8,
	isNamedContainerQuery: 9,
	isArbitraryLength: 10,
	isArbitraryNumber: 11,
	isArbitraryWeight: 12,
	isArbitraryFamilyName: 13,
	isArbitraryPosition: 14,
	isArbitrarySize: 15,
	isArbitraryImage: 16,
	isArbitraryShadow: 17,
	isArbitraryVariableLength: 18,
	isArbitraryVariableFamilyName: 19,
	isArbitraryVariablePosition: 20,
	isArbitraryVariableSize: 21,
	isArbitraryVariableImage: 22,
	isArbitraryVariableShadow: 23,
	isArbitraryVariableWeight: 24
};
const CUSTOM_OP_BASE = 25;
const newRegistry = () => ({
	names: [],
	idByName: /* @__PURE__ */ new Map(),
	impls: {},
	fnName: /* @__PURE__ */ new Map(),
	classifierFns: /* @__PURE__ */ new Map()
});
const validatorIdFor = (reg, name, impl) => {
	let id = reg.idByName.get(name);
	if (id === void 0) {
		id = reg.names.length;
		reg.names.push(name);
		reg.idByName.set(name, id);
		reg.classifierFns.set(name, impl);
	}
	return id;
};
const resolveValidator = (reg, def) => {
	if (typeof def === "function") {
		let name = reg.fnName.get(def);
		if (name === void 0) {
			name = "$c" + reg.fnName.size;
			reg.fnName.set(def, name);
			reg.impls[name] = def;
		}
		return validatorIdFor(reg, name, def);
	}
	const name = def.$v;
	const ref = validators_exports[name];
	if (OPS[name] === void 0 || !ref) throw new Error(`cn: unknown validator "${name}"`);
	return validatorIdFor(reg, name, ref);
};
const newPartNode = () => ({
	nextPart: /* @__PURE__ */ new Map(),
	validators: null,
	classGroupId: -1,
	lit: []
});
const expandTheme = (config, key) => config.theme[key] ?? [];
const buildPartTrie = (config, reg, groupId) => {
	const root = newPartNode();
	const getPart = (node, path) => {
		for (const part of path.split("-")) {
			let next = node.nextPart.get(part);
			if (!next) {
				next = newPartNode();
				node.nextPart.set(part, next);
			}
			node = next;
		}
		return node;
	};
	const process = (def, node, gid) => {
		if (typeof def === "string") {
			const target = def === "" ? node : getPart(node, def);
			target.classGroupId = gid;
			return;
		}
		if (typeof def === "function") {
			if (isThemeGetterFn(def)) {
				for (const inner of def(config.theme)) process(inner, node, gid);
				return;
			}
			(node.validators ??= []).push({
				validatorId: resolveValidator(reg, def),
				groupId: gid
			});
			return;
		}
		if (isMarker(def, "$t")) {
			for (const inner of expandTheme(config, def.$t)) process(inner, node, gid);
			return;
		}
		if (isMarker(def, "$v")) {
			(node.validators ??= []).push({
				validatorId: resolveValidator(reg, def),
				groupId: gid
			});
			return;
		}
		for (const [key, value] of Object.entries(def)) {
			const child = getPart(node, key);
			for (const inner of value) process(inner, child, gid);
		}
	};
	for (const [name, group] of Object.entries(config.classGroups)) {
		const gid = groupId(name);
		for (const def of group) process(def, root, gid);
	}
	return root;
};
const subsetConfig = (base, tokens) => {
	const config = cloneConfig(base);
	const reg = newRegistry();
	const groupNames = [];
	const idByName = /* @__PURE__ */ new Map();
	const gidOf = (name) => {
		let id = idByName.get(name);
		if (id === void 0) {
			id = groupNames.length;
			groupNames.push(name);
			idByName.set(name, id);
		}
		return id;
	};
	const root = buildPartTrie(config, reg, gidOf);
	const walk = (parts, idx, node) => {
		if (idx === parts.length) return node.classGroupId;
		const next = node.nextPart.get(parts[idx]);
		if (next) {
			const r = walk(parts, idx + 1, next);
			if (r >= 0) return r;
		}
		if (!node.validators) return -1;
		const rest = parts.slice(idx).join("-");
		for (const { validatorId, groupId } of node.validators) if (reg.classifierFns.get(reg.names[validatorId])(rest)) return groupId;
		return -1;
	};
	const classify = (bareBase) => {
		if (bareBase.startsWith("[") && bareBase.endsWith("]")) return -1;
		const parts = bareBase.split("-");
		return walk(parts, parts[0] === "" && parts.length > 1 ? 1 : 0, root);
	};
	const prefix = config.prefix ? config.prefix + ":" : null;
	const used = /* @__PURE__ */ new Set();
	for (let token of tokens) {
		if (!token) continue;
		if (prefix) {
			if (!token.startsWith(prefix)) continue;
			token = token.slice(prefix.length);
		}
		let dB = 0;
		let dP = 0;
		let lastColon = -1;
		let lastSlash = -1;
		for (let i = 0; i < token.length; i++) {
			const c = token[i];
			if (dB === 0 && dP === 0) {
				if (c === ":") lastColon = i;
				else if (c === "/") lastSlash = i;
			}
			if (c === "[") dB++;
			else if (c === "]") dB--;
			else if (c === "(") dP++;
			else if (c === ")") dP--;
		}
		let bare = token.slice(lastColon + 1);
		if (bare.endsWith("!")) bare = bare.slice(0, -1);
		else if (bare.startsWith("!")) bare = bare.slice(1);
		const candidates = lastSlash > lastColon ? [bare, token.slice(lastColon + 1, lastSlash).replace(/^!/, "")] : [bare];
		for (const cand of candidates) {
			const g = classify(cand);
			if (g >= 0) used.add(groupNames[g]);
		}
	}
	const totalGroups = Object.keys(config.classGroups).length;
	for (const key of Object.keys(config.classGroups)) if (!used.has(key)) delete config.classGroups[key];
	for (const key of Object.keys(config.conflictingClassGroups)) if (!used.has(key)) delete config.conflictingClassGroups[key];
	for (const key of Object.keys(config.conflictingClassGroupModifiers)) if (!used.has(key)) delete config.conflictingClassGroupModifiers[key];
	return {
		config,
		usedGroups: used.size,
		totalGroups
	};
};
const compileModel = (config) => {
	const reg = newRegistry();
	const groupNames = [];
	const groupIdByName = /* @__PURE__ */ new Map();
	const groupId = (name) => {
		let id = groupIdByName.get(name);
		if (id === void 0) {
			id = groupNames.length;
			groupNames.push(name);
			groupIdByName.set(name, id);
		}
		return id;
	};
	const partRoot = buildPartTrie(config, reg, groupId);
	const isLiftable = (node) => {
		if (node.validators) return false;
		for (const child of node.nextPart.values()) if (!isLiftable(child)) return false;
		return true;
	};
	const collectLifted = (node, prefix, out) => {
		if (node.classGroupId >= 0) out.push({
			tail: prefix,
			gid: node.classGroupId
		});
		for (const [part, child] of node.nextPart) collectLifted(child, prefix + "-" + part, out);
	};
	const pruneNode = (node) => {
		for (const [part, child] of [...node.nextPart]) if (isLiftable(child)) {
			collectLifted(child, part, node.lit);
			node.nextPart.delete(part);
		} else pruneNode(child);
	};
	pruneNode(partRoot);
	const charNodes = [{
		edges: /* @__PURE__ */ new Map(),
		groupId: -1,
		vlist: -1
	}];
	const newCharNode = () => {
		charNodes.push({
			edges: /* @__PURE__ */ new Map(),
			groupId: -1,
			vlist: -1
		});
		return charNodes.length - 1;
	};
	const vlists = [];
	const vlistIndex = /* @__PURE__ */ new Map();
	const internVlist = (list) => {
		const key = list.map((e) => e.validatorId + ":" + e.groupId).join(",");
		let idx = vlistIndex.get(key);
		if (idx === void 0) {
			idx = vlists.length;
			vlists.push(list.map((e) => [e.validatorId, e.groupId]));
			vlistIndex.set(key, idx);
		}
		return idx;
	};
	const insertChars = (fromIdx, str) => {
		let cur = fromIdx;
		for (let i = 0; i < str.length; i++) {
			const c = str.charCodeAt(i);
			let next = charNodes[cur].edges.get(c);
			if (next === void 0) {
				next = newCharNode();
				charNodes[cur].edges.set(c, next);
			}
			cur = next;
		}
		return cur;
	};
	const DASH = 45;
	const litEntries = [];
	const flatten = (partNode, charIdx, isRoot) => {
		if (partNode.classGroupId >= 0) charNodes[charIdx].groupId = partNode.classGroupId;
		if (partNode.validators) charNodes[charIdx].vlist = internVlist(partNode.validators);
		for (const { tail, gid } of partNode.lit) litEntries.push({
			anchor: charIdx,
			tail,
			gid
		});
		for (const [part, child] of partNode.nextPart) {
			let entry = charIdx;
			if (!isRoot) {
				let dashNode = charNodes[charIdx].edges.get(DASH);
				if (dashNode === void 0) {
					dashNode = newCharNode();
					charNodes[charIdx].edges.set(DASH, dashNode);
				}
				entry = dashNode;
			}
			const childIdx = insertChars(entry, part);
			flatten(child, childIdx, false);
		}
	};
	flatten(partRoot, 0, true);
	const litAnchorSet = new Set(litEntries.map((e) => e.anchor));
	const annotated = (i) => charNodes[i].groupId >= 0 || charNodes[i].vlist >= 0 || litAnchorSet.has(i);
	const oldToNew = /* @__PURE__ */ new Map();
	const radixNodes = [];
	const buildRadix = (oldId) => {
		const newId = radixNodes.length;
		oldToNew.set(oldId, newId);
		const n = {
			edges: [],
			groupId: charNodes[oldId].groupId,
			vlist: charNodes[oldId].vlist
		};
		radixNodes.push(n);
		const sorted = [...charNodes[oldId].edges.entries()].sort((a, b) => a[0] - b[0]);
		for (const [c, t0] of sorted) {
			let label = String.fromCharCode(c);
			let t = t0;
			while (charNodes[t].edges.size === 1 && !annotated(t)) {
				const [[c2, t2]] = charNodes[t].edges.entries();
				label += String.fromCharCode(c2);
				t = t2;
			}
			n.edges.push({
				label,
				oldTarget: t
			});
		}
		for (const e of n.edges) buildRadix(e.oldTarget);
		return newId;
	};
	buildRadix(0);
	const nodeCount = radixNodes.length;
	let totalEdges = 0;
	for (const n of radixNodes) totalEdges += n.edges.length;
	const edgeCounts = new Int32Array(nodeCount);
	const edgeLabelLen = new Int32Array(totalEdges);
	let labelText = "";
	const nodeGroup = new Int32Array(nodeCount);
	const nodeVlist = new Int32Array(nodeCount);
	const edgeTargetActual = [];
	{
		let e = 0;
		for (let i = 0; i < nodeCount; i++) {
			const n = radixNodes[i];
			edgeCounts[i] = n.edges.length;
			for (const edge of n.edges) {
				edgeLabelLen[e] = edge.label.length;
				labelText += edge.label;
				edgeTargetActual.push(oldToNew.get(edge.oldTarget));
				e++;
			}
			nodeGroup[i] = n.groupId;
			nodeVlist[i] = n.vlist;
		}
	}
	{
		const sizes = new Int32Array(nodeCount);
		for (let i = nodeCount - 1; i >= 0; i--) {
			let s = 1;
			let c = i + 1;
			for (let k = 0; k < edgeCounts[i]; k++) {
				s += sizes[c];
				c += sizes[c];
			}
			sizes[i] = s;
		}
		let e = 0;
		for (let i = 0; i < nodeCount; i++) {
			let c = i + 1;
			for (let k = 0; k < edgeCounts[i]; k++) {
				if (c !== edgeTargetActual[e]) throw new Error(`cn compiler: edge target mismatch at ${e}`);
				c += sizes[c];
				e++;
			}
		}
	}
	for (const en of litEntries) en.anchor = oldToNew.get(en.anchor);
	{
		const newId = new Int32Array(vlists.length).fill(-1);
		const order = [];
		for (let i = 0; i < nodeCount; i++) {
			const v = nodeVlist[i];
			if (v >= 0) {
				if (newId[v] === -1) {
					newId[v] = order.length;
					order.push(vlists[v]);
				}
				nodeVlist[i] = newId[v];
			}
		}
		vlists.length = 0;
		vlists.push(...order);
	}
	let totalV = 0;
	for (const l of vlists) totalV += l.length;
	const vlistValidator = new Int32Array(totalV);
	const vlistGroup = new Int32Array(totalV);
	{
		let v = 0;
		for (const l of vlists) for (const [vid, gid] of l) {
			vlistValidator[v] = vid;
			vlistGroup[v] = gid;
			v++;
		}
	}
	litEntries.sort((a, b) => a.anchor - b.anchor || a.gid - b.gid || (a.tail < b.tail ? -1 : 1));
	const attachments = [];
	for (const e of litEntries) {
		const last = attachments[attachments.length - 1];
		if (last && last.anchor === e.anchor && last.gid === e.gid) last.tails.push(e.tail);
		else attachments.push({
			anchor: e.anchor,
			gid: e.gid,
			tails: [e.tail],
			set: -1
		});
	}
	const setIndex = /* @__PURE__ */ new Map();
	const sets = [];
	for (const a of attachments) {
		const key = a.tails.join(" ");
		let s = setIndex.get(key);
		if (s === void 0) {
			s = sets.length;
			setIndex.set(key, s);
			sets.push(a.tails);
		}
		a.set = s;
	}
	for (const s of sets.flat()) if (s.includes("|") || s.includes(" ")) throw new Error("cn compiler: tail contains delimiter: " + s);
	const uniqueTailCount = new Set(sets.flat()).size;
	attachments.sort((x, y) => x.anchor - y.anchor || x.set - y.set);
	for (const targets of Object.values(config.conflictingClassGroups)) for (const n of targets) groupId(n);
	for (const targets of Object.values(config.conflictingClassGroupModifiers)) for (const n of targets) groupId(n);
	for (const n of config.postfixLookupClassGroups ?? []) groupId(n);
	const G = groupNames.length;
	const remap = new Int32Array(G).fill(-1);
	let nextNewGid = 0;
	const renum = (old) => {
		if (remap[old] === -1) remap[old] = nextNewGid++;
		return remap[old];
	};
	for (let i = 0; i < vlistGroup.length; i++) vlistGroup[i] = renum(vlistGroup[i]);
	for (const a of attachments) a.gid = renum(a.gid);
	for (let i = 0; i < nodeGroup.length; i++) if (nodeGroup[i] >= 0) nodeGroup[i] = renum(nodeGroup[i]);
	for (let g = 0; g < G; g++) if (remap[g] === -1) remap[g] = nextNewGid++;
	const newGroupName = new Array(G);
	for (let g = 0; g < G; g++) newGroupName[remap[g]] = groupNames[g];
	const adjGid = [];
	const adjCnt = [];
	const adjTgt = [];
	const patGid = [];
	const patTgt = [];
	for (let ng = 0; ng < G; ng++) {
		const name = newGroupName[ng];
		const base = (config.conflictingClassGroups[name] ?? []).map((n) => remap[groupIdByName.get(n)]);
		const mod = (config.conflictingClassGroupModifiers[name] ?? []).map((n) => remap[groupIdByName.get(n)]);
		if (base.length) {
			adjGid.push(ng);
			adjCnt.push(base.length);
			adjTgt.push(...base);
		}
		for (const m2 of mod) {
			patGid.push(ng);
			patTgt.push(m2);
		}
	}
	const postfixLookup = (config.postfixLookupClassGroups ?? []).map((n) => remap[groupIdByName.get(n)]);
	const customNames = [];
	const vlistOp = new Int32Array(vlistValidator.length);
	for (let i = 0; i < vlistValidator.length; i++) {
		const name = reg.names[vlistValidator[i]];
		const op = OPS[name];
		if (op !== void 0) vlistOp[i] = op;
		else {
			let ci = customNames.indexOf(name);
			if (ci === -1) {
				ci = customNames.length;
				customNames.push(name);
			}
			vlistOp[i] = CUSTOM_OP_BASE + ci;
		}
	}
	const patIndex = /* @__PURE__ */ new Map();
	const patCounts = [];
	const patOps = [];
	const listPat = [];
	{
		let k = 0;
		for (const l of vlists) {
			const ops = [];
			for (let j = 0; j < l.length; j++) ops.push(vlistOp[k++]);
			const key = ops.join(",");
			let p = patIndex.get(key);
			if (p === void 0) {
				p = patCounts.length;
				patIndex.set(key, p);
				patCounts.push(ops.length);
				patOps.push(...ops);
			}
			listPat.push(p);
		}
	}
	const impls = {};
	for (const name of customNames) impls[name] = reg.classifierFns.get(name);
	return {
		G,
		customNames,
		impls,
		edgeCounts,
		edgeLabelLen,
		labelText,
		edgeTargetActual,
		nodeGroup,
		nodeVlist,
		nodeCount,
		totalEdges,
		patCounts,
		patOps,
		listPat,
		vlistGroup,
		litEntries,
		sets,
		attachments,
		uniqueTailCount,
		adjGid,
		adjCnt,
		adjTgt,
		patGid,
		patTgt,
		postfixLookup,
		orderSensitiveModifiers: config.orderSensitiveModifiers.join(" "),
		prefix: config.prefix
	};
};
const prefixSums = (counts) => {
	const out = new Int32Array(counts.length + 1);
	for (let i = 0; i < counts.length; i++) out[i + 1] = out[i] + counts[i];
	return out;
};
const compileToTables = (config) => {
	const m = compileModel(config);
	const litCount = m.litEntries.length;
	const litAnchor = new Int32Array(litCount);
	const litGroup = new Int32Array(litCount);
	const litPool = new Int32Array(litCount);
	let poolText = "";
	const poolOffsets = new Int32Array(m.uniqueTailCount * 2);
	{
		const tailRef = /* @__PURE__ */ new Map();
		let nextRef = 0;
		let e = 0;
		for (const a of m.attachments) for (const tail of m.sets[a.set]) {
			let r = tailRef.get(tail);
			if (r === void 0) {
				r = nextRef++;
				tailRef.set(tail, r);
				poolOffsets[r * 2] = poolText.length;
				poolOffsets[r * 2 + 1] = tail.length;
				poolText += tail;
			}
			litAnchor[e] = a.anchor;
			litGroup[e] = a.gid;
			litPool[e] = r;
			e++;
		}
	}
	return {
		tables: {
			GROUP_COUNT: m.G,
			edgeStart: prefixSums(m.edgeCounts),
			labelStart: prefixSums(m.edgeLabelLen),
			labelText: m.labelText,
			edgeTarget: Int32Array.from(m.edgeTargetActual),
			nodeGroup: m.nodeGroup,
			nodeVlist: m.nodeVlist,
			vlistPat: prefixSums(m.patCounts),
			vlistOps: Int32Array.from(m.patOps),
			vlistRef: Int32Array.from(m.listPat),
			vlistGroup: m.vlistGroup,
			litAnchor,
			litGroup,
			litPool,
			poolOffsets,
			poolText,
			adjGid: Int32Array.from(m.adjGid),
			adjStart: prefixSums(m.adjCnt),
			adjTgt: Int32Array.from(m.adjTgt),
			patGid: Int32Array.from(m.patGid),
			patTgt: Int32Array.from(m.patTgt),
			postfixLookupGroups: Int32Array.from(m.postfixLookup),
			customValidatorNames: m.customNames,
			orderSensitiveModifiers: m.orderSensitiveModifiers
		},
		validatorImpls: m.impls,
		prefix: m.prefix
	};
};
const PACK = 48;
const packStr = (arr) => {
	const a = Array.from(arr);
	for (const v of a) if (v + PACK >= 55296 || v < 0) throw new Error("cn compiler: unpackable value " + v);
	let s = "";
	for (let i = 0; i < a.length; i += 4096) s += String.fromCharCode(...a.slice(i, i + 4096).map((v) => v + PACK));
	return JSON.stringify(s);
};
const plus1 = (arr) => Array.from(arr, (v) => v + 1);
const zig = (arr) => Array.from(arr, (v) => v << 1 ^ v >> 31);
const deltas = (arr) => {
	let prev = 0;
	return Array.from(arr, (v) => {
		const d = v - prev;
		prev = v;
		return d;
	});
};
const compileToSource = (config, options = {}) => {
	const m = compileModel(config);
	if (m.customNames.length > 0) throw new Error(`cn compiler: configs with custom validator functions cannot be emitted as a module (functions are not serializable): ${m.customNames.join(", ")}. Use createCn(config) at runtime instead.`);
	const ts = options.lang === "ts";
	const sig = {
		u: ts ? "(s: string, o = 0): Int32Array" : "(s, o = 0)",
		ps: ts ? "(counts: Int32Array): Int32Array" : "(counts)",
		dz: ts ? "(s: string): Int32Array" : "(s)"
	};
	const setsText = m.sets.map((tails) => {
		const first = tails[0];
		const last = tails[tails.length - 1];
		let length = 0;
		while (length < first.length && first[length] === last[length]) length++;
		return [first.slice(0, length), ...tails.map((tail) => tail.slice(length))].join(" ");
	}).join("|");
	const attAnchorDelta = [];
	const attGid = [];
	const attSet = [];
	{
		let prev = 0;
		for (const a of m.attachments) {
			attAnchorDelta.push(a.anchor - prev);
			prev = a.anchor;
			attGid.push(a.gid);
			attSet.push(a.set);
		}
	}
	const nodeVlistAnchors = [];
	const nodeVlistValues = [];
	for (let i = 0; i < m.nodeVlist.length; i++) if (m.nodeVlist[i] >= 0) {
		nodeVlistAnchors.push(i);
		nodeVlistValues.push(m.nodeVlist[i]);
	}
	return `${options.banner ?? "// GENERATED by the cn compiler. Do not edit."}
const P = ${PACK}
const U = ${sig.u} => {
    const out = new Int32Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) - P - o
    return out
}
const PS = ${sig.ps} => {
    const out = new Int32Array(counts.length + 1)
    for (let i = 0; i < counts.length; i++) out[i + 1] = out[i] + counts[i]
    return out
}
// zigzag-delta stream → running values
const DZ = ${sig.dz} => {
    const out = new Int32Array(s.length)
    let a = 0
    for (let i = 0; i < s.length; i++) {
        const z = s.charCodeAt(i) - P
        a += (z >>> 1) ^ -(z & 1)
        out[i] = a
    }
    return out
}
const GROUP_COUNT = ${m.G}
const customValidatorNames${ts ? ": string[]" : ""} = ${JSON.stringify(m.customNames)}
const edgeStart = PS(U(${packStr(m.edgeCounts)}))
const labelStart = PS(U(${packStr(m.edgeLabelLen)}))
const labelText = ${JSON.stringify(m.labelText)}
// pre-order tree: targets derived from edge counts via subtree sizes
const edgeTarget = (() => {
    const N = edgeStart.length - 1
    const sizes = new Int32Array(N)
    for (let i = N - 1; i >= 0; i--) {
        let s = 1
        let c = i + 1
        for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) { s += sizes[c]; c += sizes[c] }
        sizes[i] = s
    }
    const out = new Int32Array(edgeStart[N])
    let e = 0
    for (let i = 0; i < N; i++) {
        let c = i + 1
        for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) { out[e++] = c; c += sizes[c] }
    }
    return out
})()
const nodeGroup = U(${packStr(plus1(m.nodeGroup))}, 1)
// vlists = op-pattern pool + per-list refs; the engine indexes these directly
const vlistPat = PS(U(${packStr(m.patCounts)}))
const vlistOps = U(${packStr(m.patOps)})
const vlistRef = U(${packStr(m.listPat)})
const vlistGroup = DZ(${packStr(zig(deltas(m.vlistGroup)))})
// nodeVlist rebuilt sparse: (anchor deltas, vlist ids)
const nodeVlist = (() => {
    const out = new Int32Array(${m.nodeCount}).fill(-1)
    const A = DZ(${packStr(zig(deltas(nodeVlistAnchors)))})
    const V = DZ(${packStr(zig(deltas(nodeVlistValues)))})
    for (let i = 0; i < A.length; i++) out[A[i]] = V[i]
    return out
})()
const SETS = ${JSON.stringify(setsText)}.split('|').map((s) => {
    const tails = s.split(' ')
    const prefix = tails.shift()${ts ? "!" : ""}
    for (let i = 0; i < tails.length; i++) {
        tails[i] = prefix + tails[i]
    }
    return tails
})
const AA = DZ(${packStr(zig(attAnchorDelta))})
const AG = DZ(${packStr(zig(deltas(attGid)))})
const AS = DZ(${packStr(zig(deltas(attSet)))})
const litAnchor = new Int32Array(${m.litEntries.length})
const litGroup = new Int32Array(${m.litEntries.length})
const litPool = new Int32Array(${m.litEntries.length})
let poolText = ''
const poolOffsets = new Int32Array(${m.uniqueTailCount * 2})
{
    const tailRef = new Map()
    let nextRef = 0
    let e = 0
    for (let i = 0; i < AA.length; i++) {
        for (const tail of SETS[AS[i]]) {
            let r = tailRef.get(tail)
            if (r === undefined) {
                r = nextRef++
                tailRef.set(tail, r)
                poolOffsets[r * 2] = poolText.length
                poolOffsets[r * 2 + 1] = tail.length
                poolText += tail
            }
            litAnchor[e] = AA[i]
            litGroup[e] = AG[i]
            litPool[e] = r
            e++
        }
    }
}
// conflict adjacency (engine builds claim bitmask CSR at init)
const adjGid = DZ(${packStr(zig(deltas(m.adjGid)))})
const adjStart = PS(U(${packStr(m.adjCnt)}))
const adjTgt = DZ(${packStr(zig(deltas(m.adjTgt)))})
const patGid = U(${packStr(m.patGid)})
const patTgt = U(${packStr(m.patTgt)})
const postfixLookupGroups = U(${packStr(m.postfixLookup)})
const orderSensitiveModifiers = ${JSON.stringify(m.orderSensitiveModifiers)}
export default {
    GROUP_COUNT, customValidatorNames, edgeStart, labelStart, labelText,
    edgeTarget, nodeGroup, nodeVlist, vlistPat, vlistOps, vlistRef, vlistGroup,
    litAnchor, litGroup, litPool, poolOffsets, poolText,
    adjGid, adjStart, adjTgt, patGid, patTgt, postfixLookupGroups,
    orderSensitiveModifiers,${m.prefix ? " prefix: " + JSON.stringify(m.prefix) + "," : ""}
}
`;
};
const compileStats = (config) => {
	const m = compileModel(config);
	return {
		groups: m.G,
		nodes: m.nodeCount,
		edges: m.totalEdges,
		liftedLiterals: m.litEntries.length,
		uniqueTails: m.uniqueTailCount,
		vlists: m.listPat.length
	};
};

//#endregion
Object.defineProperty(exports, 'compileModel', {
  enumerable: true,
  get: function () {
    return compileModel;
  }
});
Object.defineProperty(exports, 'compileStats', {
  enumerable: true,
  get: function () {
    return compileStats;
  }
});
Object.defineProperty(exports, 'compileToSource', {
  enumerable: true,
  get: function () {
    return compileToSource;
  }
});
Object.defineProperty(exports, 'compileToTables', {
  enumerable: true,
  get: function () {
    return compileToTables;
  }
});
Object.defineProperty(exports, 'mergeConfigs', {
  enumerable: true,
  get: function () {
    return mergeConfigs;
  }
});
Object.defineProperty(exports, 'subsetConfig', {
  enumerable: true,
  get: function () {
    return subsetConfig;
  }
});