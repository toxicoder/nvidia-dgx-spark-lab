/**
 * Iframe embed for a dev workspace URL with timeout fallback when framing is blocked.
 */
"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOAD_TIMEOUT_MS = 8000;

interface WorkspaceEmbedProps {
  url: string;
  title: string;
}

/** Renders workspace UI in an iframe; shows external-link fallback after load timeout. */
export function WorkspaceEmbed({ url, title }: WorkspaceEmbedProps) {
  const [blocked, setBlocked] = React.useState(false);
  const loadedRef = React.useRef(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    loadedRef.current = false;

    timeoutRef.current = setTimeout(() => {
      if (!loadedRef.current) setBlocked(true);
      timeoutRef.current = null;
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [url]);

  const handleLoad = () => {
    loadedRef.current = true;
  };

  return (
    <div
      data-testid="workspace-embed"
      className="relative min-h-[60vh] w-full overflow-hidden rounded-lg border border-border bg-muted/30"
    >
      {!blocked && (
        <iframe
          title={title}
          src={url}
          className="h-[60vh] w-full border-0 bg-background"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          onLoad={handleLoad}
        />
      )}

      {blocked && (
        <div
          data-testid="workspace-embed-fallback"
          className="flex h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
        >
          <p className="max-w-md text-sm text-muted-foreground">
            {title} could not be embedded in the dashboard (blocked by browser security headers or still starting). Open
            it in a new tab instead.
          </p>
          <Button variant="default" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open {title}
            </a>
          </Button>
        </div>
      )}

      <div className="absolute right-3 top-3">
        <Button variant="outline" size="sm" className="h-8 bg-background/90 text-xs backdrop-blur" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            New tab
          </a>
        </Button>
      </div>
    </div>
  );
}
