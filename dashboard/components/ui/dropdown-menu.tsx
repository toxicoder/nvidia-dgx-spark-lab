"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * shadcn-style DropdownMenu over `@radix-ui/react-dropdown-menu`.
 *
 * Row actions in SecretsPanel and Treemap were icon-only buttons whose only name was a
 * `title` attribute, and there was no menu primitive to move them into. This is the
 * keyboard-operable home for those actions.
 */

/** Root of one dropdown menu. */
export const DropdownMenu = DropdownMenuPrimitive.Root;

/** The control that opens the menu. */
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/** Groups related items under one label. */
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

/** A radio-style choice inside a menu. */
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/** Nested submenu root. */
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

/** Small text describing a group of items. */
export const DropdownMenuLabel = DropdownMenuPrimitive.Label;

/** Props for {@link DropdownMenuSeparator}. */
export type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>;

/**
 * Hairline between menu groups.
 * @param props - Radix separator props.
 * @returns The separator element.
 */
export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

/** Props for {@link DropdownMenuShortcut}. */
export type DropdownMenuShortcutProps = React.HTMLAttributes<HTMLSpanElement>;

/**
 * Keyboard hint right-aligned inside an item.
 * @param props - Standard span attributes; `className` extends the layout.
 * @returns The shortcut hint.
 */
export function DropdownMenuShortcut({ className, ...props }: DropdownMenuShortcutProps): React.JSX.Element {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
}

/** Props for {@link DropdownMenuContent}. */
export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>;

/**
 * The menu surface, portalled and token-styled.
 * @param props - Radix content props.
 * @returns The menu surface.
 */
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[9rem] overflow-hidden border border-border bg-popover p-1 text-popover-foreground",
        panelRadiusClass,
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

/** Props for {@link DropdownMenuItem}. */
export type DropdownMenuItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>;

/**
 * A menu item.
 * @param props - Radix item props.
 * @returns The item.
 */
export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-slot="dropdown-menu-item"
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none",
      panelRadiusClass,
      "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

/** Props for {@link DropdownMenuCheckboxItem}. */
export type DropdownMenuCheckboxItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>;

/**
 * A toggle item that carries its own checked marker.
 * @param props - Radix checkbox item props.
 * @returns The item.
 */
export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    data-slot="dropdown-menu-checkbox-item"
    className={cn(
      "relative flex cursor-pointer select-none items-center py-1.5 pl-8 pr-2 text-sm outline-none",
      panelRadiusClass,
      "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...(checked === undefined ? {} : { checked })}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

/** Props for {@link DropdownMenuRadioItem}. */
export type DropdownMenuRadioItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>;

/**
 * A single-choice item inside a {@link DropdownMenuRadioGroup}.
 * @param props - Radix radio item props.
 * @returns The item.
 */
export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  DropdownMenuRadioItemProps
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    data-slot="dropdown-menu-radio-item"
    className={cn(
      "relative flex cursor-pointer select-none items-center py-1.5 pl-8 pr-2 text-sm outline-none",
      panelRadiusClass,
      "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

/** Props for {@link DropdownMenuSubTrigger}. */
export type DropdownMenuSubTriggerProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>;

/**
 * The item that opens a submenu.
 * @param props - Radix sub-trigger props.
 * @returns The trigger item.
 */
export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  DropdownMenuSubTriggerProps
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    data-slot="dropdown-menu-sub-trigger"
    className={cn(
      "flex cursor-pointer select-none items-center px-2 py-1.5 text-sm outline-none",
      panelRadiusClass,
      "focus:bg-accent data-[state=open]:bg-accent",
      className
    )}
    {...props}
  >
    {children}
    <span aria-hidden="true" className="ml-auto text-xs">
      ›
    </span>
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

/** Props for {@link DropdownMenuSubContent}. */
export type DropdownMenuSubContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>;

/**
 * The submenu surface.
 * @param props - Radix sub-content props.
 * @returns The submenu surface.
 */
export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  DropdownMenuSubContentProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    data-slot="dropdown-menu-sub-content"
    className={cn(
      "z-50 min-w-[9rem] overflow-hidden border border-border bg-popover p-1 text-popover-foreground",
      panelRadiusClass,
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;
