"use client";
import { cn } from "../../utils/cn.js";
import { jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import * as Primitive from "@radix-ui/react-collapsible";
//#region src/components/ui/collapsible.tsx
const Collapsible = Primitive.Root;
const CollapsibleTrigger = Primitive.CollapsibleTrigger;
function CollapsibleContent({ children, ...props }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	return /* @__PURE__ */ jsx(Primitive.CollapsibleContent, {
		...props,
		className: cn("overflow-hidden", mounted && "data-[state=closed]:animate-fd-collapsible-up data-[state=open]:animate-fd-collapsible-down", props.className),
		children
	});
}
//#endregion
export { Collapsible, CollapsibleContent, CollapsibleTrigger };
