"use client";

/**
 * Hover/focus tooltip for glossary abbreviations injected by `lib/remark-glossary.ts`.
 *
 * Native `title` bubbles are delayed and often never appear inside Fumadocs table
 * wrappers (`overflow: auto`). This component keeps the `<abbr>` markup and portals a
 * visible definition to `document.body` so clipping ancestors cannot hide it.
 */

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement
} from "react";
import { createPortal } from "react-dom";

/** Viewport-relative box of the dotted term. */
export interface GlossaryAnchorBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Measured size of the tooltip surface. */
export interface GlossaryTooltipSize {
  width: number;
  height: number;
}

/** Viewport used to clamp the tooltip. */
export interface GlossaryViewport {
  width: number;
  height: number;
}

const GAP = 8;
const MARGIN = 8;

/**
 * Place a glossary tooltip relative to its term, keeping it inside the viewport.
 *
 * Prefers sitting above the term; flips below when there is not enough room at the top.
 * Horizontal position is centred on the term, then clamped to the viewport margins.
 *
 * @param anchor Bounding box of the term.
 * @param tooltip Measured tooltip size.
 * @param viewport Visible viewport.
 * @param gap Space between the term and the tooltip.
 * @returns `top`/`left` for `position: fixed`.
 */
export function placeGlossaryTooltip(
  anchor: GlossaryAnchorBox,
  tooltip: GlossaryTooltipSize,
  viewport: GlossaryViewport,
  gap = GAP
): { top: number; left: number } {
  const maxLeft = Math.max(MARGIN, viewport.width - tooltip.width - MARGIN);
  let left = anchor.left + anchor.width / 2 - tooltip.width / 2;
  left = Math.min(Math.max(left, MARGIN), maxLeft);

  const above = anchor.top - tooltip.height - gap;
  const below = anchor.top + anchor.height + gap;
  let top = above >= MARGIN ? above : below;
  const maxTop = Math.max(MARGIN, viewport.height - tooltip.height - MARGIN);
  top = Math.min(Math.max(top, MARGIN), maxTop);
  return { top, left };
}

/**
 * MDX `abbr` replacement: dotted term plus a portal tooltip on hover and focus.
 *
 * @param props Native `abbr` props; `title` is the glossary definition.
 * @returns The abbreviation element, with a tooltip while open.
 */
export function GlossaryTerm({
  title,
  children,
  className,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ComponentPropsWithoutRef<"abbr">): ReactElement {
  const abbrRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const definition = typeof title === "string" ? title : undefined;

  useLayoutEffect(() => {
    if (!open || !definition) {
      setCoords(null);
      return;
    }

    const place = () => {
      const abbr = abbrRef.current;
      const tip = tipRef.current;
      if (!abbr || !tip) return;
      const anchor = abbr.getBoundingClientRect();
      const size = tip.getBoundingClientRect();
      setCoords(
        placeGlossaryTooltip(anchor, { width: size.width, height: size.height }, {
          width: window.innerWidth,
          height: window.innerHeight
        })
      );
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, definition]);

  const show = () => {
    if (definition) setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <>
      <abbr
        {...rest}
        ref={abbrRef}
        className={["glossary-term", className].filter(Boolean).join(" ")}
        title={open ? undefined : definition}
        tabIndex={definition ? 0 : undefined}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          show();
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          hide();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          show();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          hide();
        }}
      >
        {children}
      </abbr>
      {open &&
        definition &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tipRef}
            id={tooltipId}
            role="tooltip"
            data-glossary-tooltip=""
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              visibility: coords ? "visible" : "hidden"
            }}
          >
            {definition}
          </span>,
          document.body
        )}
    </>
  );
}
