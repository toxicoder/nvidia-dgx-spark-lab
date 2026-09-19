"use client";
import { cn } from "../../utils/cn.js";
import { jsx } from "react/jsx-runtime";
import "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
//#region src/components/ui/popover.tsx
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
function PopoverContent({ className, align = "center", sideOffset = 4, ...props }) {
	return /* @__PURE__ */ jsx(PopoverPrimitive.Portal, { children: /* @__PURE__ */ jsx(PopoverPrimitive.Content, {
		align,
		sideOffset,
		side: "bottom",
		className: cn("z-50 origin-(--radix-popover-content-transform-origin) overflow-y-auto max-h-(--radix-popover-content-available-height) min-w-[240px] max-w-[98vw] rounded-xl border bg-fd-popover/60 backdrop-blur-lg p-2 text-sm text-fd-popover-foreground shadow-lg focus-visible:outline-none data-[state=closed]:animate-fd-popover-out data-[state=open]:animate-fd-popover-in", className),
		...props
	}) });
}
const PopoverClose = PopoverPrimitive.PopoverClose;
//#endregion
export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
