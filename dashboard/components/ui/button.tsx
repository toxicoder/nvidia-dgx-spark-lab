import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Canonical shadcn/ui Button.
 *
 * *Actually imported from https://github.com/shadcn-ui/ui* (hermetic via Bazel
 * @shadcn_ui in MODULE.bazel + :shadcn_hermetic in this BUILD). Use the fetched
 * official before any custom. MD3 applied via globals + tokens.
 *
 * See the archive for the source of truth.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--md-sys-shape-corner-medium,12px)] text-sm font-medium tracking-[-0.25px] ring-offset-background transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.985]",
  {
    variants: {
      variant: {
        // MD3 filled (primary high emphasis) + shadcn default compat
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_85%,black_15%)] shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] active:bg-primary",
        filled:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_85%,black_15%)] shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] active:bg-primary",

        // MD3 filled-tonal (secondary container)
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary)_80%,var(--md-sys-color-on-secondary)_20%)]",
        tonal:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--md-sys-color-secondary)_80%,var(--md-sys-color-on-secondary)_20%)]",

        // MD3 outlined
        outline:
          "border border-[var(--md-sys-color-outline)] bg-transparent hover:bg-[var(--md-sys-color-surface-variant)] text-[var(--md-sys-color-on-surface)]",

        // MD3 text / ghost
        ghost: "hover:bg-[var(--md-sys-color-surface-variant)] text-[var(--md-sys-color-on-surface)]",
        text: "hover:bg-[var(--md-sys-color-surface-variant)] text-[var(--md-sys-color-on-surface)]",

        // shadcn compat + MD3 error role
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--md-sys-color-error)_80%,black_20%)]",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
