"use client";
import { cn } from "../../../../utils/cn.js";
import { TOCProvider as TOCProvider$1, TOCScrollArea, useTOCItems } from "../../../../components/toc/index.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { Text } from "lucide-react";
import { createContext, use, useMemo, useRef, useState } from "react";
import { useTranslations } from "@fuma-translate/react";
import { TOCItem } from "fumadocs-core/toc";
import { useOnChange } from "fumadocs-core/utils/use-on-change";
//#region src/layouts/glass/page/slots/toc.tsx
const Context = createContext(null);
function TOCProvider(props) {
	return /* @__PURE__ */ jsx(TOCProvider$1, { ...props });
}
function useContext$1() {
	return use(Context);
}
function TOC({ container, header, footer }) {
	const t = useTranslations({ note: "table of contents" });
	const items = useTOCItems();
	const [hover, setHover] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [inAnimation, setInAnimation] = useState(false);
	const exitTimerRef = useRef(null);
	const transitionTimerRef = useRef(null);
	const open = hover || mobileOpen;
	useOnChange(open, () => {
		setInAnimation(true);
		if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
		transitionTimerRef.current = window.setTimeout(() => {
			setInAnimation(false);
		}, 300);
	});
	const ctx = useMemo(() => ({
		open,
		setMobileOpen,
		inAnimation
	}), [open, inAnimation]);
	if (items.length === 0 && !footer && !header) return;
	return /* @__PURE__ */ jsxs(Context, {
		value: ctx,
		children: [/* @__PURE__ */ jsx("div", {
			className: cn("fixed inset-0 z-10 backdrop-blur-sm transition-opacity duration-300 [mask-image:radial-gradient(circle_at_center_right,white,white_200px,transparent_500px)] xl:hidden", !open && "opacity-0 pointer-events-none"),
			onClick: () => setMobileOpen(false)
		}), /* @__PURE__ */ jsx(TOCScrollArea, {
			id: "nd-toc",
			...container,
			className: cn("z-10 grid transition-[width,padding] duration-300 [grid-area:right]", "xl:sticky xl:top-10 xl:h-[calc(100dvh---spacing(10))] md:layout:[--fd-right-width:12px] xl:layout:[--fd-right-width:240px] xl:items-center xl:pe-4", "max-xl:fixed max-xl:top-1/2 max-xl:-translate-y-1/2 max-xl:end-1 max-xl:bg-fd-popover max-xl:text-fd-popover-foreground max-xl:border max-xl:rounded-xl max-xl:shadow-md max-xl:mask-none max-xl:max-h-[calc(100dvh---spacing(32))] max-xl:grid-cols-[calc(240px---spacing(6))]", inAnimation && "overflow-y-hidden", open ? "max-xl:w-[240px] max-xl:p-3" : "max-md:w-4 max-md:ps-[calc(--spacing(1.5)-1px)] max-xl:w-6 max-xl:ps-[calc(--spacing(2.5)-1px)] max-xl:overflow-clip", container?.className),
			onPointerDown: (e) => {
				if (!mobileOpen && (e.pointerType === "touch" || e.pointerType === "pen")) setMobileOpen(true);
			},
			onPointerEnter: (e) => {
				if (e.pointerType === "mouse") {
					if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
					if (!hover) setHover(true);
				}
			},
			onPointerLeave: (e) => {
				if (hover && e.pointerType === "mouse") {
					if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
					exitTimerRef.current = window.setTimeout(() => {
						setHover(false);
					}, window.innerWidth - e.clientX < 30 ? 700 : 50);
				}
			},
			children: /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col xl:items-end xl:text-end",
				children: [
					header,
					/* @__PURE__ */ jsxs("h3", {
						id: "nd-toc-title",
						className: cn("inline-flex items-center gap-1.5 overflow-hidden text-xs text-fd-muted-foreground transition-[opacity,height] opacity-0 h-0", open ? "opacity-100 h-6" : "xl:[@media(hover:none)]:opacity-100 xl:[@media(hover:none)]:h-6"),
						children: [/* @__PURE__ */ jsx(Text, { className: "size-3.5 shrink-0" }), t("On this page")]
					}),
					/* @__PURE__ */ jsx(TOCPanel, {}),
					footer
				]
			})
		})]
	});
}
function TOCPanel({ className, style, ...props }) {
	const items = useTOCItems();
	const { open, inAnimation, setMobileOpen } = useContext$1();
	return /* @__PURE__ */ jsx("div", {
		className: cn("grid grid-cols-1 transition-[grid-template-rows]", open ? "[--row:calc(6*var(--spacing))]" : "[--row:calc(3*var(--spacing))] xl:[@media(hover:none)]:[--row:calc(6*var(--spacing))]", (!open || inAnimation) && "pointer-events-none xl:[@media(hover:none)]:pointer-events-auto", className),
		style: {
			...style,
			gridTemplateRows: `repeat(${items.length}, var(--row))`
		},
		...props,
		children: items.map((item) => /* @__PURE__ */ jsxs(TOCItem, {
			href: item.url,
			className: "group prose prose-sm flex items-center gap-2 text-xs text-fd-muted-foreground transition-colors data-[active=true]:text-fd-primary data-[active=false]:hover:text-fd-accent-foreground xl:flex-row-reverse",
			onClick: () => setMobileOpen(false),
			autoScroll: open && !inAnimation,
			children: [/* @__PURE__ */ jsx("div", {
				className: cn("shrink-0 bg-fd-muted-foreground/50 rounded-full size-1 transition-[background-color,width,height] group-data-[active=true]:bg-fd-primary", open ? "w-(--width) h-px" : "transition-[width,height] duration-300 xl:[@media(hover:none)]:w-(--width) xl:[@media(hover:none)]:h-px"),
				style: { "--width": `calc(pow(${item.depth}, 1.5) * var(--spacing))` }
			}), /* @__PURE__ */ jsx("span", {
				className: cn("truncate transition-opacity opacity-0", open ? "opacity-100" : "xl:[@media(hover:none)]:opacity-100"),
				children: item.title
			})]
		}, item.url))
	});
}
//#endregion
export { TOC, TOCProvider };
