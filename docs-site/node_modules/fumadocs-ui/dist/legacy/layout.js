"use client";
import { jsx } from "react/jsx-runtime";
import { createContext, use, useEffect, useMemo, useState } from "react";
//#region src/legacy/layout.tsx
/**
* applied styles to different layout components in `Page` from layouts
*/
const StylesContext = createContext({
	tocNav: "xl:hidden",
	toc: "max-xl:hidden"
});
function usePageStyles() {
	return use(StylesContext);
}
function StylesProvider({ children, ...value }) {
	return /* @__PURE__ */ jsx(StylesContext.Provider, {
		value,
		children
	});
}
const NavContext = createContext({ isTransparent: false });
function NavProvider({ transparentMode = "none", children }) {
	const [transparent, setTransparent] = useState(transparentMode !== "none");
	useEffect(() => {
		if (transparentMode !== "top") return;
		const listener = () => {
			setTransparent(window.scrollY < 10);
		};
		listener();
		window.addEventListener("scroll", listener);
		return () => {
			window.removeEventListener("scroll", listener);
		};
	}, [transparentMode]);
	return /* @__PURE__ */ jsx(NavContext, {
		value: useMemo(() => ({ isTransparent: transparent }), [transparent]),
		children
	});
}
function useNav() {
	return use(NavContext);
}
//#endregion
export { NavProvider, StylesProvider, useNav, usePageStyles };
