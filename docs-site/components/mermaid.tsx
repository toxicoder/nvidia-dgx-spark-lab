"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Turn a React `useId()` value into a Mermaid `render()` id.
 *
 * Mermaid 12 rejects two `render()` calls that share an id, and `useId()` emits colons
 * (`:r1:`) that are not legal in the SVG id Mermaid writes. Prefixing `mmd` keeps the
 * result a CSS identifier even when the React id is only punctuation.
 *
 * @param reactId Value from `useId()`.
 * @returns A distinct, CSS-safe id.
 */
export function mermaidRenderId(reactId: string): string {
  return `mmd${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

/**
 * Renders a ```mermaid fence.
 *
 * `remarkMdxMermaid` (registered in `source.config.ts`) rewrites `mermaid` code fences into
 * `<Mermaid chart="…" />`, so this component only has to draw the diagram.  It re-renders
 * when the colour scheme flips so diagrams follow the Voltage theme instead of staying stuck
 * on Mermaid's default palette.
 */
export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [error, setError] = useState<string>();
  // `useTheme` returns an object; `resolvedTheme` is the scheme after `system` is
  // evaluated, which is what the diagram palette has to follow.
  const { resolvedTheme } = useTheme();
  const scheme = resolvedTheme === "dark" ? "dark" : "neutral";

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;

    void (async () => {
      const [{ default: mermaid }] = await Promise.all([import("mermaid"), Promise.resolve()]);
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: scheme
      });
      try {
        const { svg } = await mermaid.render(mermaidRenderId(reactId), chart);
        if (cancelled) return;
        node.innerHTML = svg;
        setError(undefined);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, scheme, reactId]);

  if (error) {
    return (
      <div className="rounded-md border border-fd-error/40 bg-fd-error/5 p-3 text-0.875rem text-fd-error">
        <p className="font-semibold">Mermaid diagram failed to render</p>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 overflow-auto text-0.75rem opacity-70">{chart}</pre>
      </div>
    );
  }

  return <div ref={ref} className="my-4 overflow-auto text-center" aria-label="Mermaid diagram" />;
}
