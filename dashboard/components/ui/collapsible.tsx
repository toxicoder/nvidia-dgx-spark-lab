"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/**
 * shadcn-style Collapsible over `@radix-ui/react-collapsible`.
 *
 * The 29-button Quick start wall in `InferencePanel` needs to fold behind "Show all
 * models" above a threshold, and the profile pickers need a disclosure that keeps the
 * trigger's accessible name. Radix supplies `aria-expanded` and the hidden state;
 * hand-rolled `useState` + `hidden` would have had to be tested for exactly that.
 */

/** Root of one disclosure. */
export const Collapsible = CollapsiblePrimitive.Root;

/** The button that opens and closes the region. */
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

/** The disclosed region; removed from the a11y tree while closed. */
export const CollapsibleContent = CollapsiblePrimitive.Content;
