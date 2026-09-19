"use client";
import { cn } from "../../utils/cn.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { ChevronRight } from "lucide-react";
import * as Primitive from "@radix-ui/react-accordion";
//#region src/components/ui/accordion.tsx
function Accordion({ className, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Root, {
		className: cn("divide-y divide-fd-border overflow-hidden rounded-lg border bg-fd-card", className),
		...props
	});
}
function AccordionItem({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Item, {
		className: cn("scroll-m-24", className),
		...props,
		children
	});
}
function AccordionHeader({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Header, {
		className: cn("not-prose flex flex-row items-center text-fd-card-foreground font-medium has-focus-visible:bg-fd-accent", className),
		...props,
		children
	});
}
function AccordionTrigger({ className, children, ...props }) {
	return /* @__PURE__ */ jsxs(Primitive.Trigger, {
		className: cn("group flex flex-1 items-center gap-2 px-3 py-2.5 text-start focus-visible:outline-none", className),
		...props,
		children: [/* @__PURE__ */ jsx(ChevronRight, { className: "size-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" }), children]
	});
}
function AccordionContent({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Content, {
		className: cn("overflow-hidden data-[state=closed]:animate-fd-accordion-up data-[state=open]:animate-fd-accordion-down", className),
		...props,
		children
	});
}
//#endregion
export { Accordion, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger };
