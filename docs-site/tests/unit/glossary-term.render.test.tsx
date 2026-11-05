/**
 * Tests for the glossary term's hover/focus surface.
 *
 * CONTRACT: the dotted `<abbr>` stays inside the table cell and the definition travels in a
 * portal on `document.body`, so an `overflow: auto` Fumadocs table wrapper cannot clip it
 * away.  A reader who hovers the term, or who tabs to it with the keyboard, must get the same
 * definition, positioned from the measured term and the measured surface, and must lose it
 * again when the pointer or the focus leaves.  The native `title` is kept only while the
 * surface is shut, so the definition is never announced twice.
 *
 * Placement itself is `placeGlossaryTooltip`, pinned in `glossary-term.test.ts`; here the
 * question is whether the component drives it correctly: what opens and closes the surface,
 * what the term is tagged with while it is open, and whether the measured boxes reach it.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlossaryTerm } from "../../components/glossary-term";

const TERM = "Grace";
const DEFINITION = "NVIDIA Grace CPU, the host half of a GB10";

/** A viewport roomy enough that clamping is not what a test is about. */
const VIEWPORT = { width: 1000, height: 800 };
/** Box the surface reports for its own size. */
const SURFACE = { width: 200, height: 40 };
/** Box the term reports when a test does not care where it sits. */
const MID_PAGE = { top: 400, left: 400, width: 80, height: 16 };

/** Axis-aligned box, in the shape `placeGlossaryTooltip` reads. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Turn a box into the DOMRect jsdom would have handed back; extents may be omitted. */
function toRect(box: Partial<Box>): DOMRect {
  const measured = { top: 0, left: 0, width: 0, height: 0, ...box };
  return {
    ...measured,
    x: measured.left,
    y: measured.top,
    right: measured.left + measured.width,
    bottom: measured.top + measured.height,
    toJSON: () => ({})
  } as DOMRect;
}

/** Globals this file redefines, put back exactly as jsdom left them. */
const redefined = new Map<string, PropertyDescriptor | undefined>();

function redefine(key: string, value: unknown): void {
  if (!redefined.has(key)) redefined.set(key, Object.getOwnPropertyDescriptor(window, key));
  Object.defineProperty(window, key, { configurable: true, value });
}

afterEach(() => {
  for (const [key, descriptor] of redefined) {
    if (descriptor) Object.defineProperty(window, key, descriptor);
    else Reflect.deleteProperty(window, key);
  }
  redefined.clear();
  vi.restoreAllMocks();
});

/** Boxes handed back by the stubbed measure, mutable so a test can move the term. */
interface Boxes {
  term: Box;
  surface: { width: number; height: number };
}

/**
 * Answer `getBoundingClientRect` from `boxes`.
 *
 * jsdom measures nothing, so every box would be zero and a placement test could not tell a
 * correct top from a clamped one.  The surface is told apart by the attribute only the
 * portal carries.
 */
function stubMeasure(boxes: Boxes): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element
  ): DOMRect {
    return toRect(this.hasAttribute("data-glossary-tooltip") ? boxes.surface : boxes.term);
  });
  redefine("innerWidth", VIEWPORT.width);
  redefine("innerHeight", VIEWPORT.height);
}

/**
 * Fire a window-level event and let React settle.
 *
 * The listeners are outside React's own event system, so the state they set has to be
 * flushed by hand the way RTL does for a click.
 */
function emit(eventName: string): void {
  act(() => {
    window.dispatchEvent(new Event(eventName));
  });
}

/** The dotted term. */
function term(container: HTMLElement): HTMLElement {
  const abbr = container.querySelector<HTMLElement>("abbr");
  expect(abbr, "the term itself").not.toBeNull();
  return abbr as HTMLElement;
}

/** The portalled definition, or null while the surface is shut. */
function surface(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-glossary-tooltip]");
}

/**
 * The `useRef` object React holds for an element's `ref` prop.
 *
 * Detaching a ref is the only way to catch a placement pass that races the surface
 * disappearing; the guard is unobservable from the outside, so the test reaches for the same
 * handle React uses.
 */
function refOf(element: Element): { current: unknown } | undefined {
  const fiberKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith("__reactFiber$")
  );
  if (!fiberKey) return undefined;
  const holder = element as unknown as Record<string, { ref?: { current: unknown } }>;
  return holder[fiberKey]?.ref;
}

describe("GlossaryTerm markup", () => {
  it("keeps the native title on the term while the surface is shut", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    expect(abbr.tagName).toBe("ABBR");
    expect(abbr).toHaveTextContent(TERM);
    expect(abbr.getAttribute("title")).toBe(DEFINITION);
    expect(abbr.getAttribute("aria-describedby")).toBeNull();
    expect(surface()).toBeNull();
  });

  it("makes the term focusable so the keyboard reaches the definition", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    expect(term(container).getAttribute("tabindex")).toBe("0");
  });

  it("leaves an undefined term as plain text with no tab stop", () => {
    const { container } = render(<GlossaryTerm>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    expect(abbr.getAttribute("title")).toBeNull();
    expect(abbr.getAttribute("tabindex")).toBeNull();
  });

  it("ignores a non-string title rather than rendering an object as a definition", () => {
    const { container } = render(
      <GlossaryTerm title={{ toString: () => DEFINITION } as unknown as string}>{TERM}</GlossaryTerm>
    );
    fireEvent.mouseEnter(term(container));
    expect(surface()).toBeNull();
  });

  it("appends a caller class to the dotted-term class", () => {
    const { container } = render(
      <GlossaryTerm title={DEFINITION} className="text-nowrap">
        {TERM}
      </GlossaryTerm>
    );
    expect(term(container).className).toBe("glossary-term text-nowrap");
  });

  it("keeps the class list valid with no caller class", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    expect(term(container).className).toBe("glossary-term");
  });

  it("passes an unrelated attribute through to the abbreviation", () => {
    const { container } = render(
      <GlossaryTerm title={DEFINITION} data-testid="glossary-grace">
        {TERM}
      </GlossaryTerm>
    );
    expect(term(container).getAttribute("data-testid")).toBe("glossary-grace");
  });
});

describe("GlossaryTerm pointer and focus", () => {
  it("opens the definition into a body-level portal on hover", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.mouseEnter(term(container));
    const tip = surface();
    expect(tip).not.toBeNull();
    expect(tip).toHaveTextContent(DEFINITION);
    expect(tip?.closest("abbr")).toBeNull();
  });

  it("points the term at the open surface and drops the duplicate native title", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    fireEvent.mouseEnter(abbr);
    const describedBy = abbr.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(surface()?.id).toBe(describedBy);
    expect(abbr.getAttribute("title")).toBeNull();
  });

  it("closes the surface and restores the native title when the pointer leaves", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    fireEvent.mouseEnter(abbr);
    fireEvent.mouseLeave(abbr);
    expect(surface()).toBeNull();
    expect(abbr.getAttribute("title")).toBe(DEFINITION);
    expect(abbr.getAttribute("aria-describedby")).toBeNull();
  });

  it("opens the definition on keyboard focus", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.focus(term(container));
    expect(surface()).toHaveTextContent(DEFINITION);
  });

  it("closes the surface on blur", () => {
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    fireEvent.focus(abbr);
    fireEvent.blur(abbr);
    expect(surface()).toBeNull();
  });

  it("does not open anything for a term with no definition", () => {
    const { container } = render(<GlossaryTerm>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    fireEvent.mouseEnter(abbr);
    fireEvent.focus(abbr);
    expect(surface()).toBeNull();
  });

  it("runs the caller's own pointer and focus handlers alongside its own", () => {
    const handlers = {
      onMouseEnter: vi.fn(),
      onMouseLeave: vi.fn(),
      onFocus: vi.fn(),
      onBlur: vi.fn()
    };
    const { container } = render(
      <GlossaryTerm title={DEFINITION} {...handlers}>
        {TERM}
      </GlossaryTerm>
    );
    const abbr = term(container);
    fireEvent.mouseEnter(abbr);
    fireEvent.mouseLeave(abbr);
    fireEvent.focus(abbr);
    fireEvent.blur(abbr);
    expect(handlers.onMouseEnter).toHaveBeenCalledTimes(1);
    expect(handlers.onMouseLeave).toHaveBeenCalledTimes(1);
    expect(handlers.onFocus).toHaveBeenCalledTimes(1);
    expect(handlers.onBlur).toHaveBeenCalledTimes(1);
    expect(handlers.onMouseEnter).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mouseenter", target: abbr })
    );
    expect(handlers.onBlur).toHaveBeenCalledWith(
      expect.objectContaining({ type: "blur", target: abbr })
    );
  });
});

describe("GlossaryTerm placement", () => {
  it("places the surface above the measured term", () => {
    stubMeasure({ term: MID_PAGE, surface: SURFACE });
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.mouseEnter(term(container));
    const tip = surface();
    expect(tip?.style.top).toBe(`${MID_PAGE.top - SURFACE.height - 8}px`);
    expect(tip?.style.left).toBe(`${MID_PAGE.left + MID_PAGE.width / 2 - SURFACE.width / 2}px`);
    expect(tip?.style.visibility).toBe("visible");
  });

  it("flips the surface below a term that sits against the top of the viewport", () => {
    stubMeasure({ term: { top: 20, left: 400, width: 80, height: 16 }, surface: SURFACE });
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.mouseEnter(term(container));
    expect(surface()?.style.top).toBe(`${20 + 16 + 8}px`);
  });

  it("keeps the surface inside the viewport when the term sits at the right edge", () => {
    stubMeasure({ term: { top: 400, left: 950, width: 20, height: 16 }, surface: SURFACE });
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.mouseEnter(term(container));
    expect(surface()?.style.left).toBe(`${VIEWPORT.width - SURFACE.width - 8}px`);
  });

  it("re-measures when the page scrolls, so the surface follows the term", () => {
    const boxes: Boxes = { term: { ...MID_PAGE }, surface: SURFACE };
    stubMeasure(boxes);
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.mouseEnter(term(container));
    const opened = surface();
    expect(opened?.style.top).toBe(`${MID_PAGE.top - SURFACE.height - 8}px`);
    boxes.term = { ...MID_PAGE, top: 600 };
    emit("scroll");
    expect(surface()?.style.top).toBe(`${600 - SURFACE.height - 8}px`);
  });

  it("re-measures when the viewport resizes, so an off-screen surface is pulled back", () => {
    const boxes: Boxes = { term: { ...MID_PAGE }, surface: SURFACE };
    stubMeasure(boxes);
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    fireEvent.focus(term(container));
    expect(surface()?.style.top).toBe(`${MID_PAGE.top - SURFACE.height - 8}px`);
    const shorterViewport = 300;
    redefine("innerHeight", shorterViewport);
    emit("resize");
    const tip = surface();
    expect(tip?.style.top).toBe(`${shorterViewport - SURFACE.height - 8}px`);
    expect(tip?.style.left).toBe(`${MID_PAGE.left + MID_PAGE.width / 2 - SURFACE.width / 2}px`);
  });

  it("keeps the surface hidden until it has been measured", () => {
    stubMeasure({ term: MID_PAGE, surface: SURFACE });
    const { container } = render(<GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>);
    const abbr = term(container);
    const termRef = refOf(abbr);
    expect(termRef, "React ref handle for the term").toBeDefined();
    const measured = termRef?.current;
    termRef!.current = null;
    fireEvent.mouseEnter(abbr);
    const tip = surface();
    expect(tip).not.toBeNull();
    expect(tip?.style.visibility).toBe("hidden");
    expect(tip?.style.top).toBe("0px");
    expect(tip?.style.left).toBe("0px");

    termRef!.current = measured;
    emit("resize");
    expect(surface()?.style.visibility).toBe("visible");
    expect(surface()?.style.top).toBe(`${MID_PAGE.top - SURFACE.height - 8}px`);
  });

  it("withdraws the surface when the definition goes away while it is open", () => {
    stubMeasure({ term: MID_PAGE, surface: SURFACE });
    const { container, rerender } = render(
      <GlossaryTerm title={DEFINITION}>{TERM}</GlossaryTerm>
    );
    fireEvent.mouseEnter(term(container));
    expect(surface()).not.toBeNull();
    rerender(<GlossaryTerm>{TERM}</GlossaryTerm>);
    expect(surface()).toBeNull();
    expect(term(container)).toHaveTextContent(TERM);
  });
});
