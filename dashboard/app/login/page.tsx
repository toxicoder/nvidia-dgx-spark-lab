import type React from "react";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Login route — public entry; renders `LoginForm` inside a card shell. */
export const dynamic = "force-dynamic";

/**
 * Public login page with email/password form.
 * @returns Login page JSX wrapped in a card shell.
 */
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">DGX Spark Lab Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-4">
            Sign in to access the self-hosted control plane.
          </p>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
