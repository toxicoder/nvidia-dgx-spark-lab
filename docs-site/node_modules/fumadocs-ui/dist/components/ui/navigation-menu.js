"use client";
import { cn } from "../../utils/cn.js";
import { jsx } from "react/jsx-runtime";
import "react";
import * as Primitive from "@radix-ui/react-navigation-menu";
//#region src/components/ui/navigation-menu.tsx
const NavigationMenu = Primitive.Root;
const NavigationMenuList = Primitive.List;
function NavigationMenuItem({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.NavigationMenuItem, {
		className: cn("list-none", className),
		...props,
		children
	});
}
function NavigationMenuTrigger({ className, children, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Trigger, {
		className: cn("data-[state=open]:bg-fd-accent/50", className),
		...props,
		children
	});
}
function NavigationMenuContent({ className, ...props }) {
	return /* @__PURE__ */ jsx(Primitive.Content, {
		className: cn("absolute inset-x-0 top-0 overflow-auto fd-scroll-container max-h-[80svh] data-[motion=from-end]:animate-fd-enterFromRight data-[motion=from-start]:animate-fd-enterFromLeft data-[motion=to-end]:animate-fd-exitToRight data-[motion=to-start]:animate-fd-exitToLeft", className),
		...props
	});
}
const NavigationMenuLink = Primitive.Link;
function NavigationMenuViewport({ className, ref, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		ref,
		className: "flex w-full justify-center",
		children: /* @__PURE__ */ jsx(Primitive.Viewport, {
			...props,
			className: cn("relative h-(--radix-navigation-menu-viewport-height) w-full origin-[top_center] overflow-hidden transition-[width,height] duration-300 data-[state=closed]:animate-fd-nav-menu-out data-[state=open]:animate-fd-nav-menu-in", className)
		})
	});
}
//#endregion
export { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, NavigationMenuViewport };
