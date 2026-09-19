Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
//#region src/lite.ts
const clsx = function() {
	let str = "";
	for (let i = 0; i < arguments.length; i++) {
		const tmp = arguments[i];
		if (tmp && typeof tmp === "string") {
			if (str) str += " ";
			str += tmp;
		}
	}
	return str;
};

//#endregion
exports.clsx = clsx;
exports.default = clsx;