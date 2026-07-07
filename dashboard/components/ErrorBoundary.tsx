"use client";

import React from "react";

/**
 * Lightweight reusable ErrorBoundary for client subtree protection.
 *
 * Why: Next.js segment error.tsx are great for page-level, but for isolated
 * interactive components (Treemap viz with Recharts, dynamic panels) we want
 * to prevent full panel crash from bad data/render (e.g. recharts edge case).
 *
 * Usage:
 *   <ErrorBoundary fallback={<div>Chart error (safe)</div>}>
 *     <Treemap ... />
 *   </ErrorBoundary>
 *
 * This is a classic React class boundary (functional can't catch render errors).
 * Keep it small and dependency-free.
 *
 * Safety: none (pure UI). Dashboard only.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/** React error boundary that isolates render failures in dashboard subtrees. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // In real use could forward to toast/log service; keep minimal here.
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="rounded border border-destructive/40 p-3 text-xs text-destructive">
          Something went wrong rendering this section.
          <button className="ml-2 underline" onClick={() => this.setState({ hasError: false, error: undefined })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
