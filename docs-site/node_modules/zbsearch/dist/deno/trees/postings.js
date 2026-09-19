export function createPostingsMap() {
	return new Map();
}
export function getPostings(postings, word) {
	return postings.get(word) ?? [];
}
export function addPosting(postings, word, docId) {
	let list = postings.get(word);
	if (!list) {
		list = [];
		postings.set(word, list);
	}
	if (!list.includes(docId)) {
		list.push(docId);
	}
}
export function appendPosting(postings, word, docId) {
	let list = postings.get(word);
	if (!list) {
		list = [docId];
		postings.set(word, list);
		return;
	}
	list.push(docId);
}
export function removePosting(postings, word, docId) {
	const list = postings.get(word);
	if (!list) {
		return false;
	}
	const index = list.indexOf(docId);
	if (index === -1) {
		return false;
	}
	list.splice(index, 1);
	if (list.length === 0) {
		postings.delete(word);
	}
	return true;
}
export function clearPostings(postings, word) {
	postings.delete(word);
}
export function getDocumentFrequency(postings, word) {
	return postings.get(word)?.length ?? 0;
}
/** Delta-encode sorted doc IDs for compact storage. */
export function encodePostings(ids) {
	if (ids.length === 0) {
		return [];
	}
	const sorted = [...ids].sort((a, b) => a - b);
	const out = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) {
		out.push(sorted[i] - sorted[i - 1]);
	}
	return out;
}
export function decodePostings(encoded) {
	if (encoded.length === 0) {
		return [];
	}
	const out = [encoded[0]];
	for (let i = 1; i < encoded.length; i++) {
		out.push(out[i - 1] + encoded[i]);
	}
	return out;
}
export function serializePostingsMap(postings) {
	const out = {};
	for (const [word, ids] of postings) {
		if (ids.length > 0) {
			out[word] = encodePostings(ids);
		}
	}
	return out;
}
export function deserializePostingsMap(data) {
	const postings = createPostingsMap();
	if (!data) {
		return postings;
	}
	for (const word of Object.keys(data)) {
		const ids = decodePostings(data[word]);
		if (ids.length > 0) {
			postings.set(word, ids);
		}
	}
	return postings;
}
/** Collect doc IDs stored on legacy radix nodes (`d` arrays). */
export function collectLegacyNodePostings(nodeJson, postings) {
	if (nodeJson.e && nodeJson.w !== undefined) {
		const ids = nodeJson.d ?? [];
		if (ids.length > 0) {
			postings.set(nodeJson.w, [...ids]);
		}
	}
	const children = nodeJson.c ?? [];
	for (let i = 0; i < children.length; i++) {
		collectLegacyNodePostings(children[i][1], postings);
	}
}

//# sourceMappingURL=postings.js.map
