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
export { clsx, clsx as default };