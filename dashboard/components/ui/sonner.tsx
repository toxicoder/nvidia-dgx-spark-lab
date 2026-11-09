"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/ThemeProvider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      data-testid="ui-toaster"
      theme={theme.mode}
      className="toaster group"
      toastOptions={{
        classNames: {
          // Sonner declares its own `font-family` on the toast, so the app's bundled faces only
          // reach it when the toaster asks: left alone, toast text measured in the host's system
          // face and the `dashboard-ui-toast` golden disagreed between machines.
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:font-sans rounded-[var(--md-sys-shape-corner-medium)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
