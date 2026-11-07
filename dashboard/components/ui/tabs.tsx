"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { panelRadiusClass } from "@/components/panel-styles";

/**
 * Tabs, rebuilt on `@radix-ui/react-tabs`.
 *
 * The previous version was hand-rolled: it rendered `role="tab"`/`role="tabpanel"` by
 * hand but never linked `aria-controls` to `aria-labelledby`, and gave every trigger
 * `tabIndex: 0`, so Tab walked through every tab instead of leaving the tablist. Radix
 * implements the WAI-ARIA pattern — roving `tabIndex`, Arrow/Home/End selection,
 * trigger/panel id linkage — and the exported names and `data-testid` values are kept
 * because panel tests and the visual specs key off them.
 */

/** Props for {@link Tabs}. */
export type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

/**
 * Lets a trigger complete a selection on `click`.
 *
 * Radix activates a tab on `mousedown`. A real pointer produces both, but a caller that
 * drives its tabs with a plain `click` — a keyboard-synthesised one, or an existing panel
 * test firing `fireEvent.click` — would otherwise never switch. The trigger only calls
 * this when it is not already the active tab, so a real press-and-release selects once.
 */
const TabsSelectionContext = React.createContext<((value: string) => void) | null>(null);

/**
 * The tab group; controlled by the caller, as before.
 * @param props - Radix tabs props.
 * @returns The tablist root.
 */
export function Tabs({ className, onValueChange, ...props }: TabsProps): React.JSX.Element {
  const requestSelect = React.useCallback((value: string) => onValueChange?.(value), [onValueChange]);
  const controlledProps: { onValueChange?: (value: string) => void } = onValueChange ? { onValueChange } : {};

  return (
    <TabsSelectionContext.Provider value={requestSelect}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-testid="ui-tabs"
        className={cn("w-full", className)}
        {...controlledProps}
        {...props}
      />
    </TabsSelectionContext.Provider>
  );
}

/** Props for {@link TabsList}. */
export type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

/**
 * The strip of triggers.
 * @param props - Radix list props.
 * @returns The `role="tablist"` container.
 */
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      data-testid="ui-tabs-list"
      className={cn(
        "inline-flex h-10 items-center justify-center bg-muted p-1 text-muted-foreground",
        panelRadiusClass,
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

/** Props for {@link TabsTrigger}. */
export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;

/**
 * One tab. `value` doubles as the `data-testid` suffix.
 * @param props - Radix trigger props; `value` is required.
 * @returns The `role="tab"` button.
 */
export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const requestSelect = React.useContext(TabsSelectionContext);

    return (
      <TabsPrimitive.Trigger
        ref={ref}
        data-slot="tabs-trigger"
        data-testid={`ui-tabs-trigger-${value}`}
        value={value}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (event.currentTarget.getAttribute("data-state") !== "active") requestSelect?.(value);
        }}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
          panelRadiusClass,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          className
        )}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/** Props for {@link TabsContent}. */
export type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

/**
 * The panel a trigger shows.
 * @param props - Radix content props; `value` selects which panel is visible.
 * @returns The `role="tabpanel"` region, hidden while its trigger is unselected.
 */
export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, TabsContentProps>(
  ({ className, value, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      data-testid={`ui-tabs-content-${value}`}
      value={value}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
);
TabsContent.displayName = TabsPrimitive.Content.displayName;
