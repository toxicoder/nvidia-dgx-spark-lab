//#region src/lib/binary.ts
/**
* Reads past the end of `data` yield `undefined`, which the bitwise operators below
* coerce to `0`. Parsers rely on that: they length-check before trusting a value, and
* a short buffer simply fails to match instead of throwing.
*/
/** Byte values of a latin1 signature, for use with {@link sliceEq}. */
function signature(str) {
	const out = [];
	for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 255);
	return out;
}
/** Whether `data` contains `expected` at `start`. */
function sliceEq(data, start, expected) {
	for (let i = start, j = 0; j < expected.length;) if (data[i++] !== expected[j++]) return false;
	return true;
}
/** Read `[start, end)` as latin1 — the encoding every container uses for its tags. */
function ascii(data, start, end) {
	let out = "";
	for (let i = start; i < end && i < data.length; i++) out += String.fromCharCode(data[i]);
	return out;
}
function readUInt16LE(data, offset) {
	return data[offset] | data[offset + 1] << 8;
}
function readUInt16BE(data, offset) {
	return data[offset] << 8 | data[offset + 1];
}
function readInt16LE(data, offset) {
	return readUInt16LE(data, offset) << 16 >> 16;
}
function readUInt32LE(data, offset) {
	return (data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16) + data[offset + 3] * 16777216;
}
function readUInt32BE(data, offset) {
	return data[offset] * 16777216 + (data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3]);
}
function readInt32LE(data, offset) {
	return readUInt32LE(data, offset) | 0;
}
//#endregion
//#region src/lib/miaf.ts
/**
* Box parsing for MIAF-based containers (AVIF / HEIC / HEIF).
*
* ISO media file spec:
*   https://web.archive.org/web/20180219054429/http://l.web.umkc.edu/lizhu/teaching/2016sp.video-communication/ref/mp4.pdf
* ISO image file format spec:
*   https://standards.iso.org/ittf/PubliclyAvailableStandards/c066067_ISO_IEC_23008-12_2017.zip
*
* Images whose metadata is written after the image data are not supported, and
* neither are images without an `ispe` box.
*/
/**
* ```
* interface Box {
*   size:       uint32;   // if size == 0, box lasts until EOF
*   boxtype:    char[4];
*   largesize?: uint64;   // only if size == 1
*   usertype?:  char[16]; // only if boxtype == 'uuid'
* }
* ```
*/
function unbox(data, offset) {
	if (data.length < 4 + offset) return;
	const size = readUInt32BE(data, offset);
	if (data.length < size + offset || size < 8) return;
	return {
		boxtype: ascii(data, offset + 4, offset + 8),
		data: data.subarray(offset + 8, offset + size),
		end: offset + size
	};
}
/** `meta` -> `iprp` -> `ipco`, which holds one `ispe` per stored image */
function scanIpco(data, sizes) {
	for (let box = unbox(data, 0); box; box = unbox(data, box.end)) if (box.boxtype === "ispe") sizes.push({
		width: readUInt32BE(box.data, 4),
		height: readUInt32BE(box.data, 8)
	});
}
function scanIprp(data, sizes) {
	for (let box = unbox(data, 0); box; box = unbox(data, box.end)) if (box.boxtype === "ipco") scanIpco(box.data, sizes);
}
function scanMeta(data, sizes) {
	for (let box = unbox(data, 4); box; box = unbox(data, box.end)) if (box.boxtype === "iprp") scanIprp(box.data, sizes);
}
/** The image with the largest single dimension, used as the base size. */
function getMaxSize(sizes) {
	const maxWidthSize = sizes.reduce((a, b) => a.width > b.width || a.width === b.width && a.height > b.height ? a : b);
	const maxHeightSize = sizes.reduce((a, b) => a.height > b.height || a.height === b.height && a.width > b.width ? a : b);
	if (maxWidthSize.width > maxHeightSize.height || maxWidthSize.width === maxHeightSize.height && maxWidthSize.height > maxHeightSize.width) return maxWidthSize;
	return maxHeightSize;
}
function readSizeFromMeta(data) {
	const sizes = [];
	scanMeta(data, sizes);
	if (sizes.length === 0) return;
	return {
		size: getMaxSize(sizes),
		variants: sizes
	};
}
function getMimeType(data) {
	const brand = ascii(data, 0, 4);
	const compat = { [brand]: true };
	for (let i = 8; i < data.length; i += 4) compat[ascii(data, i, i + 4)] = true;
	if (!compat.mif1 && !compat.msf1 && !compat.miaf) return;
	if (brand === "avif" || brand === "avis" || brand === "avio") return {
		type: "avif",
		mime: "image/avif"
	};
	if (brand === "heic" || brand === "heix") return {
		type: "heic",
		mime: "image/heic"
	};
	if (brand === "hevc" || brand === "hevx") return {
		type: "heic",
		mime: "image/heic-sequence"
	};
	if (compat.avif || compat.avis) return {
		type: "avif",
		mime: "image/avif"
	};
	if (compat.heic || compat.heix || compat.hevc || compat.hevx || compat.heis) {
		if (compat.msf1) return {
			type: "heif",
			mime: "image/heif-sequence"
		};
		return {
			type: "heif",
			mime: "image/heif"
		};
	}
	return {
		type: "avif",
		mime: "image/avif"
	};
}
//#endregion
//#region src/parsers/avif.ts
const SIG_FTYP = signature("ftyp");
const avif = (data) => {
	if (!sliceEq(data, 4, SIG_FTYP)) return;
	const firstBox = unbox(data, 0);
	if (!firstBox) return;
	const fileType = getMimeType(firstBox.data);
	if (!fileType) return;
	let meta;
	for (let box = unbox(data, firstBox.end); box; box = unbox(data, box.end)) {
		if (box.boxtype === "mdat") return;
		if (box.boxtype === "meta") {
			meta = box.data;
			break;
		}
	}
	if (!meta) return;
	const found = readSizeFromMeta(meta);
	if (!found) return;
	return {
		width: found.size.width,
		height: found.size.height,
		type: fileType.type,
		mime: fileType.mime,
		...found.variants.length > 1 ? { variants: found.variants } : {}
	};
};
//#endregion
//#region src/parsers/bmp.ts
const SIG_BM = signature("BM");
const bmp = (data) => {
	if (data.length < 26) return;
	if (!sliceEq(data, 0, SIG_BM)) return;
	const headerSize = readUInt32LE(data, 14);
	let width;
	let height;
	if (headerSize === 12) {
		width = readInt16LE(data, 18);
		height = readInt16LE(data, 20);
	} else if (headerSize > 12) {
		width = readInt32LE(data, 18);
		height = readInt32LE(data, 22);
	} else return;
	return {
		width,
		height: Math.abs(height),
		type: "bmp",
		mime: "image/bmp"
	};
};
//#endregion
//#region src/parsers/gif.ts
const SIG_GIF87a = signature("GIF87a");
const SIG_GIF89a = signature("GIF89a");
const gif = (data) => {
	if (data.length < 10) return;
	if (!sliceEq(data, 0, SIG_GIF87a) && !sliceEq(data, 0, SIG_GIF89a)) return;
	return {
		width: readUInt16LE(data, 6),
		height: readUInt16LE(data, 8),
		type: "gif",
		mime: "image/gif"
	};
};
//#endregion
//#region src/parsers/ico.ts
const HEADER = 0;
const TYPE_ICO = 1;
const INDEX_SIZE = 16;
/** https://en.wikipedia.org/wiki/ICO_(file_format)#Icon_resource_structure */
const ico = (data) => {
	if (data.length < 6) return;
	const header = readUInt16LE(data, 0);
	const type = readUInt16LE(data, 2);
	const numImages = readUInt16LE(data, 4);
	if (header !== HEADER || type !== TYPE_ICO || !numImages) return;
	if (data.length < 6 + numImages * INDEX_SIZE) return;
	const variants = [];
	let maxSize = {
		width: 0,
		height: 0
	};
	for (let i = 0; i < numImages; i++) {
		const width = data[6 + INDEX_SIZE * i] || 256;
		const height = data[6 + INDEX_SIZE * i + 1] || 256;
		const size = {
			width,
			height
		};
		variants.push(size);
		if (width > maxSize.width || height > maxSize.height) maxSize = size;
	}
	return {
		width: maxSize.width,
		height: maxSize.height,
		variants,
		type: "ico",
		mime: "image/x-icon"
	};
};
//#endregion
//#region src/parsers/jpeg.ts
const jpeg = (data) => {
	if (data.length < 2) return;
	if (data[0] !== 255 || data[1] !== 216 || data[2] !== 255) return;
	let offset = 2;
	while (offset < data.length) {
		while (offset < data.length && data[offset] !== 255) offset++;
		if (data.length - offset < 2) return;
		offset++;
		let code = data[offset++];
		let length;
		while (code === 255) code = data[offset++];
		if (code >= 208 && code <= 217 || code === 1) length = 0;
		else if (code >= 192 && code <= 254) {
			if (data.length - offset < 2) return;
			length = readUInt16BE(data, offset) - 2;
			offset += 2;
		} else return;
		if (code === 217 || code === 218) return;
		if (length >= 5 && code >= 192 && code <= 207 && code !== 196 && code !== 200 && code !== 204) {
			if (data.length - offset < length) return;
			return {
				width: readUInt16BE(data, offset + 3),
				height: readUInt16BE(data, offset + 1),
				type: "jpg",
				mime: "image/jpeg"
			};
		}
		offset += length;
	}
};
//#endregion
//#region src/parsers/png.ts
const SIG_PNG = signature("PNG\r\n\n");
const SIG_IHDR = signature("IHDR");
const png = (data) => {
	if (data.length < 24) return;
	if (!sliceEq(data, 0, SIG_PNG)) return;
	if (!sliceEq(data, 12, SIG_IHDR)) return;
	return {
		width: readUInt32BE(data, 16),
		height: readUInt32BE(data, 20),
		type: "png",
		mime: "image/png"
	};
};
//#endregion
//#region src/parsers/psd.ts
const SIG_8BPS = signature("8BPS\0");
const psd = (data) => {
	if (data.length < 22) return;
	if (!sliceEq(data, 0, SIG_8BPS)) return;
	return {
		width: readUInt32BE(data, 18),
		height: readUInt32BE(data, 14),
		type: "psd",
		mime: "image/vnd.adobe.photoshop"
	};
};
//#endregion
//#region src/parsers/svg.ts
const SVG_TAG_RE = /^<([-_.:a-zA-Z0-9]+:)?svg\s/;
const SVG_WIDTH_RE = /[^-]\bwidth="([^%]+?)"|[^-]\bwidth='([^%]+?)'/;
const SVG_HEIGHT_RE = /\bheight="([^%]+?)"|\bheight='([^%]+?)'/;
const SVG_VIEWBOX_RE = /\bview[bB]ox="(.+?)"|\bview[bB]ox='(.+?)'/;
const SVG_UNITS_RE = /in$|mm$|cm$|pt$|pc$|px$|em$|ex$/;
/**
* CSS absolute lengths, in pixels. `em`/`ex` assume the 16px default font size,
* which is the best guess available without rendering the document.
*/
const UNITS = {
	px: 1,
	in: 96,
	cm: 96 / 2.54,
	mm: 96 / 25.4,
	pt: 96 / 72,
	pc: 16,
	em: 16,
	ex: 8
};
const decoder = new TextDecoder("latin1");
function isWhiteSpace(chr) {
	return chr === 32 || chr === 9 || chr === 13 || chr === 10;
}
/** matches the `[-_.:a-zA-Z0-9]` element name class */
function isNameStart(chr) {
	return chr >= 97 && chr <= 122 || chr >= 65 && chr <= 90 || chr >= 48 && chr <= 57 || chr === 45 || chr === 95 || chr === 46 || chr === 58;
}
/**
* The first element-like tag, skipping `<?` declarations and `<!` directives.
*
* A single forward scan — the obvious regex (`/<[name][^>]*>/`) backtracks over
* `[^>]*` at every candidate and turns quadratic on `<`-riddled non-XML input.
*/
function rootTag(str) {
	for (let lt = str.indexOf("<"); lt !== -1; lt = str.indexOf("<", lt + 1)) {
		if (!isNameStart(str.charCodeAt(lt + 1))) continue;
		const gt = str.indexOf(">", lt);
		if (gt === -1) return;
		return str.slice(lt, gt + 1);
	}
}
function canBeSvg(data) {
	let i = 0;
	if (data[0] === 239 && data[1] === 187 && data[2] === 191) i = 3;
	while (i < data.length && isWhiteSpace(data[i])) i++;
	if (i === data.length) return false;
	return data[i] === 60;
}
/** Filters out NaN, Infinity and non-positive values. */
function isFinitePositive(value) {
	return Number.isFinite(value) && value > 0;
}
function unitOf(str) {
	return str.match(SVG_UNITS_RE)?.[0] ?? "px";
}
/** Length in pixels, or `NaN` when it isn't a usable number. */
function toPixels(str) {
	if (!str) return NaN;
	return Number.parseFloat(str) * UNITS[unitOf(str)];
}
const svg = (data) => {
	if (!canBeSvg(data)) return;
	const svgTag = rootTag(decoder.decode(data));
	if (!svgTag || !SVG_TAG_RE.test(svgTag)) return;
	const widthAttr = svgTag.match(SVG_WIDTH_RE);
	const heightAttr = svgTag.match(SVG_HEIGHT_RE);
	const viewBoxAttr = svgTag.match(SVG_VIEWBOX_RE);
	const rawWidth = widthAttr?.[1] || widthAttr?.[2];
	const rawHeight = heightAttr?.[1] || heightAttr?.[2];
	const rawViewBox = viewBoxAttr?.[1] || viewBoxAttr?.[2];
	const width = toPixels(rawWidth);
	const height = toPixels(rawHeight);
	if (rawWidth && rawHeight) {
		if (!isFinitePositive(width) || !isFinitePositive(height)) return;
		return {
			width,
			height,
			type: "svg",
			mime: "image/svg+xml"
		};
	}
	const parts = (rawViewBox || "").split(" ");
	const vbWidth = Number.parseFloat(parts[2]);
	const vbHeight = Number.parseFloat(parts[3]);
	if (!isFinitePositive(vbWidth) || !isFinitePositive(vbHeight)) return;
	if (unitOf(parts[2]) !== unitOf(parts[3])) return;
	const ratio = vbWidth / vbHeight;
	if (rawWidth) {
		if (!isFinitePositive(width)) return;
		return {
			width,
			height: width / ratio,
			type: "svg",
			mime: "image/svg+xml"
		};
	}
	if (rawHeight) {
		if (!isFinitePositive(height)) return;
		return {
			width: height * ratio,
			height,
			type: "svg",
			mime: "image/svg+xml"
		};
	}
	return {
		width: vbWidth * UNITS[unitOf(parts[2])],
		height: vbHeight * UNITS[unitOf(parts[3])],
		type: "svg",
		mime: "image/svg+xml"
	};
};
//#endregion
//#region src/parsers/tiff.ts
const SIG_LE = signature("II*\0");
const SIG_BE = signature("MM\0*");
const TAG_WIDTH = 256;
const TAG_HEIGHT = 257;
function readUInt16(data, offset, isBigEndian) {
	return isBigEndian ? readUInt16BE(data, offset) : readUInt16LE(data, offset);
}
function readUInt32(data, offset, isBigEndian) {
	return isBigEndian ? readUInt32BE(data, offset) : readUInt32LE(data, offset);
}
function readIFDValue(data, offset, isBigEndian) {
	const type = readUInt16(data, offset + 2, isBigEndian);
	if (readUInt32(data, offset + 4, isBigEndian) !== 1 || type !== 3 && type !== 4) return;
	if (type === 3) return readUInt16(data, offset + 8, isBigEndian);
	return readUInt32(data, offset + 8, isBigEndian);
}
const tiff = (data) => {
	if (data.length < 8) return;
	if (!sliceEq(data, 0, SIG_LE) && !sliceEq(data, 0, SIG_BE)) return;
	const isBigEndian = data[0] === 77;
	const count = readUInt32(data, 4, isBigEndian) - 8;
	if (count < 0) return;
	let offset = count + 8;
	if (data.length - offset < 2) return;
	const ifdSize = readUInt16(data, offset, isBigEndian) * 12;
	if (ifdSize <= 0) return;
	offset += 2;
	if (data.length - offset < ifdSize) return;
	let width;
	let height;
	for (let i = 0; i < ifdSize; i += 12) {
		const tag = readUInt16(data, offset + i, isBigEndian);
		if (tag === TAG_WIDTH) width = readIFDValue(data, offset + i, isBigEndian);
		else if (tag === TAG_HEIGHT) height = readIFDValue(data, offset + i, isBigEndian);
	}
	if (!width || !height) return;
	return {
		width,
		height,
		type: "tiff",
		mime: "image/tiff"
	};
};
/** covers 256 IFD entries in one read, far more than real files carry */
const IFD_WINDOW = 3074;
/**
* TIFF is the one supported format whose dimensions may sit beyond a bounded
* head read: the header stores a pointer to the IFD, and writers often place
* that table after the image data. Follow the pointer with targeted reads and
* hand a synthesized, minimal TIFF to the regular parser.
*/
async function tiffFromReader(head, readAt) {
	if (head.length < 8) return;
	if (!sliceEq(head, 0, SIG_LE) && !sliceEq(head, 0, SIG_BE)) return;
	const isBigEndian = head[0] === 77;
	const ifdOffset = readUInt32(head, 4, isBigEndian);
	let ifd = await readAt(ifdOffset, IFD_WINDOW);
	if (ifd.length < 2) return;
	const size = 2 + readUInt16(ifd, 0, isBigEndian) * 12;
	if (ifd.length < size) {
		const rest = await readAt(ifdOffset + ifd.length, size - ifd.length);
		const joined = new Uint8Array(ifd.length + rest.length);
		joined.set(ifd);
		joined.set(rest, ifd.length);
		ifd = joined;
	}
	const fake = new Uint8Array(8 + ifd.length);
	fake.set(head.subarray(0, 4));
	new DataView(fake.buffer).setUint32(4, 8, !isBigEndian);
	fake.set(ifd, 8);
	return tiff(fake);
}
//#endregion
//#region src/parsers/webp.ts
const SIG_RIFF = signature("RIFF");
const SIG_WEBP = signature("WEBP");
function base(width, height) {
	return {
		width,
		height,
		type: "webp",
		mime: "image/webp"
	};
}
/** lossy */
function parseVP8(data, offset) {
	if (data[offset + 3] !== 157 || data[offset + 4] !== 1 || data[offset + 5] !== 42) return;
	return base(readUInt16LE(data, offset + 6) & 16383, readUInt16LE(data, offset + 8) & 16383);
}
/** lossless */
function parseVP8L(data, offset) {
	if (data[offset] !== 47) return;
	const bits = readUInt32LE(data, offset + 1);
	return base((bits & 16383) + 1, (bits >> 14 & 16383) + 1);
}
/** extended (alpha, animation, ...) */
function parseVP8X(data, offset) {
	return base((data[offset + 6] << 16 | data[offset + 5] << 8 | data[offset + 4]) + 1, (data[offset + 9] << 16 | data[offset + 8] << 8 | data[offset + 7]) + 1);
}
const webp = (data) => {
	if (data.length < 16) return;
	if (!sliceEq(data, 0, SIG_RIFF) || !sliceEq(data, 8, SIG_WEBP)) return;
	const fileLength = readUInt32LE(data, 4) + 8;
	if (fileLength > data.length) return;
	let offset = 12;
	let result;
	while (offset + 8 < fileLength) {
		if (data[offset] === 0) {
			offset++;
			continue;
		}
		const header = ascii(data, offset, offset + 4);
		const length = readUInt32LE(data, offset + 4);
		if (header === "VP8 " && length >= 10) result ??= parseVP8(data, offset + 8);
		else if (header === "VP8L" && length >= 5) result ??= parseVP8L(data, offset + 8);
		else if (header === "VP8X" && length >= 10) result ??= parseVP8X(data, offset + 8);
		offset += 8 + length;
	}
	return result;
};
//#endregion
//#region src/parsers/index.ts
/**
* Tried in order, first match wins. Signatures don't overlap, so the order only
* decides which parser gets to reject a malformed file first.
*/
const parsers = [
	avif,
	bmp,
	gif,
	ico,
	jpeg,
	png,
	psd,
	svg,
	tiff,
	webp
];
//#endregion
//#region src/error.ts
var ImageSizeError = class extends Error {
	code;
	/** HTTP status, set when `code` is `EHTTP`. */
	statusCode;
	constructor(message, code, statusCode) {
		super(message);
		this.name = "ImageSizeError";
		this.code = code;
		this.statusCode = statusCode;
	}
};
//#endregion
//#region src/lib/source.ts
const CHUNK_SIZE = 65536;
/**
* A stalled server would otherwise hang the caller forever — reading an image
* header is quick, so anything this slow is better reported than waited on.
*/
const DEFAULT_TIMEOUT = 3e4;
/**
* `node:fs` is imported lazily so that importing this package stays harmless
* outside Node — `imageSize()` is pure and works anywhere.
*/
function fileSource(src) {
	let handle;
	const open = () => handle ??= import("node:fs/promises").then((fs) => fs.open(src, "r"));
	return {
		async *stream(limit) {
			const file = await open();
			const buffer = new Uint8Array(CHUNK_SIZE);
			let position = 0;
			while (position < limit) {
				const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, limit - position), position);
				if (bytesRead === 0) return;
				position += bytesRead;
				yield buffer.subarray(0, bytesRead);
			}
		},
		async readAt(position, length) {
			const file = await open();
			const buffer = new Uint8Array(length);
			let read = 0;
			while (read < length) {
				const { bytesRead } = await file.read(buffer, read, length - read, position + read);
				if (bytesRead === 0) break;
				read += bytesRead;
			}
			return buffer.subarray(0, read);
		},
		async close() {
			await handle?.then((file) => file.close()).catch(() => {});
		}
	};
}
function urlSource(url, options = {}) {
	const { timeout = DEFAULT_TIMEOUT, headers } = options;
	async function request(extra) {
		const controller = new AbortController();
		const timer = Number.isFinite(timeout) && timeout > 0 ? setTimeout(() => controller.abort(new ImageSizeError(`timed out after ${timeout}ms`, "ETIMEDOUT")), timeout) : void 0;
		try {
			return {
				res: await fetch(url, {
					signal: controller.signal,
					redirect: "follow",
					headers: extra ? {
						...headers,
						...extra
					} : headers
				}),
				done: () => clearTimeout(timer)
			};
		} catch (error) {
			clearTimeout(timer);
			throw error;
		}
	}
	function assertBody(res) {
		if (!res.ok && res.status !== 206) throw new ImageSizeError(`bad status code: ${res.status}`, "EHTTP", res.status);
		if (!res.body) throw new ImageSizeError("response has no body", "ECONTENT");
		return res.body;
	}
	return {
		async *stream() {
			const { res, done } = await request();
			try {
				yield* assertBody(res);
			} finally {
				done();
			}
		},
		async readAt(position, length) {
			const { res, done } = await request({ range: `bytes=${position}-${position + length - 1}` });
			try {
				if (res.status === 416) return /* @__PURE__ */ new Uint8Array(0);
				let skip = res.status === 206 ? 0 : position;
				const out = new Uint8Array(length);
				let read = 0;
				for await (let chunk of assertBody(res)) {
					if (skip > 0) {
						if (chunk.length <= skip) {
							skip -= chunk.length;
							continue;
						}
						chunk = chunk.subarray(skip);
						skip = 0;
					}
					const take = Math.min(chunk.length, length - read);
					out.set(chunk.subarray(0, take), read);
					read += take;
					if (read >= length) break;
				}
				return out.subarray(0, read);
			} finally {
				done();
			}
		},
		async close() {}
	};
}
//#endregion
//#region src/index.ts
/**
* How far into an image the sequential scan looks. Every supported format
* keeps its header up front — the one exception, a TIFF whose IFD trails the
* image data, is followed with a targeted read instead.
*/
const MAX_INPUT_SIZE = 524288;
const INITIAL_CAPACITY = 16384;
/**
* Read the size of a fully loaded image.
*
* Returns `null` when the data isn't a supported image — including when it is
* simply too short, so a partial image can be retried with more bytes.
*/
function imageSize(data) {
	for (const parse of parsers) {
		const result = parse(data);
		if (result) return result.width > 0 && result.height > 0 ? result : null;
	}
	return null;
}
/**
* Read the size of an image from a file path or an `http(s)` URL, downloading
* (or reading) no more than the header it takes to answer.
*
* @param src - a path, a `file:` URL, or an `http(s)` URL
* @throws {ImageSizeError} when the image can't be read or isn't a supported format
*/
async function probe(src, { limit = MAX_INPUT_SIZE, ...request } = {}) {
	const source = isRemote(src) ? urlSource(src, request) : fileSource(src);
	try {
		const buffer = new GrowableBuffer();
		for await (const chunk of source.stream(limit)) {
			buffer.push(chunk);
			const size = imageSize(buffer.view());
			if (size) return size;
			if (buffer.length >= limit) break;
		}
		const trailing = await tiffFromReader(buffer.view(), source.readAt);
		if (trailing) return trailing;
		throw new ImageSizeError("unrecognized file format", "ECONTENT");
	} finally {
		await source.close();
	}
}
function isRemote(src) {
	if (typeof src !== "string") return src.protocol === "http:" || src.protocol === "https:";
	return /^https?:\/\//i.test(src);
}
/**
* Parsers need one contiguous buffer, and each new chunk may be the one that
* completes the header — so the bytes are accumulated rather than streamed.
*/
var GrowableBuffer = class {
	#buffer = new Uint8Array(INITIAL_CAPACITY);
	length = 0;
	push(chunk) {
		const required = this.length + chunk.length;
		if (required > this.#buffer.length) {
			let capacity = this.#buffer.length;
			while (capacity < required) capacity *= 2;
			const grown = new Uint8Array(capacity);
			grown.set(this.#buffer.subarray(0, this.length));
			this.#buffer = grown;
		}
		this.#buffer.set(chunk, this.length);
		this.length = required;
	}
	view() {
		return this.#buffer.subarray(0, this.length);
	}
};
//#endregion
export { ImageSizeError, imageSize, probe };
