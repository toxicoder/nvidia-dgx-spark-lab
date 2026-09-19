"use client";
import { cn } from "../../utils/cn.js";
import { NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuTrigger } from "../../components/ui/navigation-menu.js";
import { navItemVariants } from "./slots/header.js";
import Link from "fumadocs-core/link";
import { jsx } from "react/jsx-runtime";
//#region src/layouts/home/navbar.tsx
const NavbarMenu = NavigationMenuItem;
function NavbarMenuContent(props) {
	return /* @__PURE__ */ jsx(NavigationMenuContent, {
		...props,
		className: cn("grid grid-cols-1 gap-2 p-4 md:grid-cols-2 lg:grid-cols-3", props.className),
		children: props.children
	});
}
function NavbarMenuTrigger(props) {
	return /* @__PURE__ */ jsx(NavigationMenuTrigger, {
		...props,
		className: cn(navItemVariants(), "text-sm rounded-md", props.className),
		children: props.children
	});
}
function NavbarMenuLink(props) {
	return /* @__PURE__ */ jsx(NavigationMenuLink, {
		asChild: true,
		children: /* @__PURE__ */ jsx(Link, {
			...props,
			className: cn("flex flex-col gap-2 rounded-lg border bg-fd-card p-3 transition-colors hover:bg-fd-accent/80 hover:text-fd-accent-foreground", props.className),
			children: props.children
		})
	});
}
//#endregion
export { NavbarMenu, NavbarMenuContent, NavbarMenuLink, NavbarMenuTrigger };
