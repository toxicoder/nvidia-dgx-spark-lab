"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CHUNK_SIZE = exports.CHUNKED_FORMAT_VERSION = void 0;
exports.isChunkedRawData = isChunkedRawData;
exports.toChunkedRawData = toChunkedRawData;
exports.stringifyChunked = stringifyChunked;
exports.parseChunked = parseChunked;
exports.fromChunkedRawData = fromChunkedRawData;
exports.fromChunkedRawDataAsync = fromChunkedRawDataAsync;
exports.load = load;
exports.loadAsync = loadAsync;
exports.save = save;
const utils_js_1 = require("../utils.js");
exports.CHUNKED_FORMAT_VERSION = 2;
exports.DEFAULT_CHUNK_SIZE = 512 * 1024;
const MAX_KEYS_TO_DESCEND = 32;
function isChunkedRawData(data) {
    return (typeof data === 'object' &&
        data !== null &&
        typeof data.version === 'number' &&
        Array.isArray(data.chunks));
}
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function splitArray(value, chunkSize, chunks) {
    let start = 0;
    let emitted = 0;
    while (start < value.length) {
        let end = start;
        let length = 2;
        while (end < value.length) {
            const piece = JSON.stringify(value[end]) ?? 'null';
            if (length + piece.length + 1 > chunkSize && end > start)
                break;
            length += piece.length + 1;
            end++;
        }
        chunks.push(JSON.stringify(value.slice(start, end)));
        emitted++;
        start = end;
    }
    return emitted;
}
function splitRecord(value, chunkSize, chunks) {
    const keys = Object.keys(value);
    let start = 0;
    let emitted = 0;
    while (start < keys.length) {
        const slice = {};
        let length = 2;
        let end = start;
        while (end < keys.length) {
            const key = keys[end];
            const piece = JSON.stringify(value[key]);
            if (piece === undefined) {
                end++;
                continue;
            }
            const cost = piece.length + key.length + 4;
            if (length + cost > chunkSize && end > start)
                break;
            slice[key] = value[key];
            length += cost;
            end++;
        }
        if (end === start)
            end++;
        chunks.push(JSON.stringify(slice));
        emitted++;
        start = end;
    }
    return emitted;
}
function splitValue(value, path, chunkSize, chunks, parts) {
    const serialized = JSON.stringify(value);
    if (serialized === undefined)
        return;
    if (serialized.length <= chunkSize) {
        parts.push({ p: path, k: 'value', n: 1 });
        chunks.push(serialized);
        return;
    }
    if (Array.isArray(value)) {
        const n = splitArray(value, chunkSize, chunks);
        parts.push({ p: path, k: 'array', n });
        return;
    }
    if (isPlainRecord(value)) {
        const keys = Object.keys(value);
        if (keys.length <= MAX_KEYS_TO_DESCEND) {
            for (const key of keys) {
                splitValue(value[key], [...path, key], chunkSize, chunks, parts);
            }
            return;
        }
        const n = splitRecord(value, chunkSize, chunks);
        parts.push({ p: path, k: 'record', n });
        return;
    }
    parts.push({ p: path, k: 'value', n: 1 });
    chunks.push(serialized);
}
function toChunkedRawData(raw, chunkSize = exports.DEFAULT_CHUNK_SIZE) {
    if (!Number.isInteger(chunkSize) || chunkSize < 1024) {
        throw new TypeError(`chunkSize must be an integer of at least 1024, got "${chunkSize}"`);
    }
    const chunks = [];
    const parts = [];
    splitValue(raw, [], chunkSize, chunks, parts);
    const header = { v: exports.CHUNKED_FORMAT_VERSION, parts };
    chunks.unshift(JSON.stringify(header));
    return { version: exports.CHUNKED_FORMAT_VERSION, chunks };
}
function stringifyChunked(data) {
    return data.chunks.join('\n');
}
function parseChunked(text) {
    const chunks = text.split('\n');
    const header = JSON.parse(chunks[0]);
    return { version: header.v, chunks };
}
function containerAt(root, path) {
    let node = root;
    const full = ['root', ...path];
    for (let i = 0; i < full.length - 1; i++) {
        const key = full[i];
        if (!isPlainRecord(node[key]))
            node[key] = {};
        node = node[key];
    }
    return { parent: node, key: full[full.length - 1] };
}
function beginPart(root, part) {
    const { parent, key } = containerAt(root, part.p);
    if (part.k === 'value')
        return { parent, key, target: null };
    const target = part.k === 'array' ? [] : {};
    parent[key] = target;
    return { parent, key, target };
}
function applyPiece(slot, part, piece) {
    if (part.k === 'value') {
        slot.parent[slot.key] = piece;
        return;
    }
    if (part.k === 'array') {
        const target = slot.target;
        for (const item of piece)
            target.push(item);
        return;
    }
    Object.assign(slot.target, piece);
}
function readHeader(data) {
    if (data.version !== exports.CHUNKED_FORMAT_VERSION) {
        throw new TypeError(`unsupported chunked index version ${data.version}, this build understands ${exports.CHUNKED_FORMAT_VERSION}`);
    }
    if (!data.chunks.length) {
        throw new TypeError('chunked index is empty');
    }
    return JSON.parse(data.chunks[0]);
}
function fromChunkedRawData(data) {
    const header = readHeader(data);
    const root = {};
    let cursor = 1;
    for (const part of header.parts) {
        const slot = beginPart(root, part);
        for (let i = 0; i < part.n; i++) {
            applyPiece(slot, part, JSON.parse(data.chunks[cursor++]));
        }
    }
    return root['root'];
}
async function fromChunkedRawDataAsync(data) {
    const header = readHeader(data);
    const root = {};
    let cursor = 1;
    for (const part of header.parts) {
        const slot = beginPart(root, part);
        for (let i = 0; i < part.n; i++) {
            applyPiece(slot, part, JSON.parse(data.chunks[cursor++]));
            if (cursor < data.chunks.length)
                await (0, utils_js_1.yieldToEventLoop)();
        }
    }
    return root['root'];
}
function load(zbsearch, raw) {
    const data = isChunkedRawData(raw) ? fromChunkedRawData(raw) : raw;
    zbsearch.internalDocumentIDStore.load(zbsearch, data.internalDocumentIDStore);
    zbsearch.data.index = zbsearch.index.load(zbsearch.internalDocumentIDStore, data.index, zbsearch.indexes);
    zbsearch.data.docs = zbsearch.documentsStore.load(zbsearch.internalDocumentIDStore, data.docs);
    zbsearch.data.sorting = zbsearch.sorter.load(zbsearch.internalDocumentIDStore, data.sorting);
    zbsearch.data.pinning = zbsearch.pinning.load(zbsearch.internalDocumentIDStore, data.pinning);
    zbsearch.tokenizer.language = data.language;
}
async function loadAsync(zbsearch, raw) {
    const data = isChunkedRawData(raw) ? await fromChunkedRawDataAsync(raw) : raw;
    zbsearch.internalDocumentIDStore.load(zbsearch, data.internalDocumentIDStore);
    await (0, utils_js_1.yieldToEventLoop)();
    zbsearch.data.index = zbsearch.index.loadAsync
        ? await zbsearch.index.loadAsync(zbsearch.internalDocumentIDStore, data.index, zbsearch.indexes)
        : zbsearch.index.load(zbsearch.internalDocumentIDStore, data.index, zbsearch.indexes);
    await (0, utils_js_1.yieldToEventLoop)();
    zbsearch.data.docs = zbsearch.documentsStore.load(zbsearch.internalDocumentIDStore, data.docs);
    await (0, utils_js_1.yieldToEventLoop)();
    zbsearch.data.sorting = zbsearch.sorter.loadAsync
        ? await zbsearch.sorter.loadAsync(zbsearch.internalDocumentIDStore, data.sorting)
        : zbsearch.sorter.load(zbsearch.internalDocumentIDStore, data.sorting);
    await (0, utils_js_1.yieldToEventLoop)();
    zbsearch.data.pinning = zbsearch.pinning.load(zbsearch.internalDocumentIDStore, data.pinning);
    zbsearch.tokenizer.language = data.language;
}
function save(zbsearch, options) {
    const raw = {
        internalDocumentIDStore: zbsearch.internalDocumentIDStore.save(zbsearch.internalDocumentIDStore),
        index: zbsearch.index.save(zbsearch.data.index),
        docs: zbsearch.documentsStore.save(zbsearch.data.docs),
        sorting: zbsearch.sorter.save(zbsearch.data.sorting),
        pinning: zbsearch.pinning.save(zbsearch.data.pinning),
        language: zbsearch.tokenizer.language
    };
    if (options?.format !== 'chunked')
        return raw;
    return toChunkedRawData(raw, options.chunkSize ?? exports.DEFAULT_CHUNK_SIZE);
}
//# sourceMappingURL=serialization.js.map