"use client";
import { cn } from "../../../utils/cn.js";
import { jsx } from "react/jsx-runtime";
import { Airplay, Moon, Sun } from "lucide-react";
import { cva } from "class-variance-authority";
import { useEffect, useState } from "react";
import { useTranslations } from "@fuma-translate/react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
//#region src/layouts/shared/slots/theme-switch.tsx
const itemVariants = cva("size-6.5 p-1.5 text-fd-muted-foreground", { variants: { active: {
	true: "bg-fd-accent text-fd-accent-foreground",
	false: "text-fd-muted-foreground"
} } });
const full = [
	["light", Sun],
	["dark", Moon],
	["system", Airplay]
];
function ThemeSwitch({ className, mode = "light-dark", ...props }) {
	const { setTheme, theme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const t = useTranslations({ note: "theme switcher" });
	const themeAriaLabels = {
		light: t("Light", { note: "aria-label" }),
		dark: t("Dark", { note: "aria-label" }),
		system: t("System", { note: "aria-label" })
	};
	const handleThemeChange = (newTheme) => {
		if (document?.startViewTransition) document.startViewTransition(() => flushSync(() => setTheme(newTheme)));
		else setTheme(newTheme);
	};
	useEffect(() => {
		setMounted(true);
	}, []);
	const container = cn("inline-flex items-center rounded-full border p-1 overflow-hidden *:rounded-full", className);
	if (mode === "light-dark") {
		const value = mounted ? resolvedTheme : null;
		return /* @__PURE__ */ jsx("button", {
			className: container,
			"aria-label": t("Toggle Theme", { note: "aria-label" }),
			onClick: () => handleThemeChange(value === "light" ? "dark" : "light"),
			"data-theme-toggle": "",
			children: full.map(([key, Icon]) => {
				if (key === "system") return;
				return /* @__PURE__ */ jsx(Icon, {
					fill: "currentColor",
					className: cn(itemVariants({ active: value === key }))
				}, key);
			})
		});
	}
	const value = mounted ? theme : null;
	return /* @__PURE__ */ jsx("div", {
		className: container,
		"data-theme-toggle": "",
		...props,
		children: full.map(([key, Icon]) => /* @__PURE__ */ jsx("button", {
			"aria-label": themeAriaLabels[key],
			className: cn(itemVariants({ active: value === key })),
			onClick: () => handleThemeChange(key),
			children: /* @__PURE__ */ jsx(Icon, {
				className: "size-full",
				fill: "currentColor"
			})
		}, key))
	});
}
//#endregion
export { ThemeSwitch };
