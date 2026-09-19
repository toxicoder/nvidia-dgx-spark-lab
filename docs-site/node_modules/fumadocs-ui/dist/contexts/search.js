"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { Suspense, createContext, lazy, use, useEffect, useEffectEvent, useMemo, useState } from "react";
//#region src/contexts/search.tsx
const SearchContext = createContext({
	enabled: false,
	open: false,
	hotKey: [],
	setOpenSearch: () => void 0
});
function useSearchContext() {
	return use(SearchContext);
}
function MetaOrControl() {
	const [key, setKey] = useState("⌘");
	useEffect(() => {
		if (/Windows|Linux/i.test(window.navigator.userAgent)) setKey("Ctrl");
	}, []);
	return key;
}
const DEFAULT_HOT_KEYS = [{
	key: (e) => e.metaKey || e.ctrlKey,
	display: /* @__PURE__ */ jsx(MetaOrControl, {})
}, {
	key: "k",
	display: "K"
}];
const DefaultSearchDialog = lazy(() => import("../components/dialog/search-default.js"));
function SearchProvider({ SearchDialog = DefaultSearchDialog, children, preload = true, options, hotKey = DEFAULT_HOT_KEYS, links }) {
	const [isOpen, setIsOpen] = useState(preload ? false : void 0);
	const onKeyDown = useEffectEvent((e) => {
		if (hotKey.every((v) => typeof v.key === "string" ? e.key === v.key : v.key(e))) {
			setIsOpen((open) => !open);
			e.preventDefault();
		}
	});
	useEffect(() => {
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);
	return /* @__PURE__ */ jsxs(SearchContext, {
		value: useMemo(() => ({
			enabled: true,
			open: isOpen ?? false,
			hotKey,
			setOpenSearch: setIsOpen
		}), [isOpen, hotKey]),
		children: [/* @__PURE__ */ jsx(Suspense, {
			fallback: null,
			children: isOpen !== void 0 && /* @__PURE__ */ jsx(SearchDialog, {
				open: isOpen,
				onOpenChange: setIsOpen,
				links,
				...options
			})
		}), children]
	});
}
/**
* Show children only when search is enabled via React Context
*/
function SearchOnly({ children }) {
	if (useSearchContext().enabled) return children;
}
//#endregion
export { SearchOnly, SearchProvider, useSearchContext };
