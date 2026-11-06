/**
 * Tests for the search dialog used in the static export.
 *
 * The published docs are an `output: "export"` build with no server to query, so search runs
 * in the browser against the index that `app/api/search/route.ts` writes out.  Two things
 * have to stay true for that to work: the static client is built with the active locale
 * (a wrong locale silently returns nothing useful for a translated corpus), and the result
 * list is handed `null` rather than the literal `"empty"` sentinel that `useDocsSearch`
 * returns, which would otherwise render a bogus row.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  staticClient: [] as unknown[],
  root: [] as Record<string, unknown>[],
  list: [] as Record<string, unknown>[]
}));
const searchState = vi.hoisted(() => ({
  search: "" as string,
  query: { data: [] as unknown[], isLoading: false }
}));

vi.mock("fumadocs-ui/components/dialog/search", () => ({
  // The source imports this as `SearchDialog as SearchDialogRoot`, so the export name here
  // has to match the module's own name, not the local alias.
  SearchDialog: (props: Record<string, unknown>) => {
    calls.root.push(props);
    return <div data-testid="dialog-root">{props.children as React.ReactNode}</div>;
  },
  SearchDialogOverlay: () => <div data-testid="dialog-overlay" />,
  SearchDialogContent: (props: Record<string, unknown>) => (
    <div data-testid="dialog-content">{props.children as React.ReactNode}</div>
  ),
  SearchDialogHeader: (props: Record<string, unknown>) => (
    <div data-testid="dialog-header">{props.children as React.ReactNode}</div>
  ),
  SearchDialogIcon: () => <span data-testid="dialog-icon" />,
  SearchDialogInput: () => <input data-testid="dialog-input" />,
  SearchDialogClose: () => <button type="button" data-testid="dialog-close" />,
  SearchDialogList: (props: Record<string, unknown>) => {
    calls.list.push(props);
    return <ul data-testid="dialog-list" />;
  }
}));

vi.mock("fumadocs-core/search/client", () => ({
  useDocsSearch: () => ({
    search: searchState.search,
    setSearch: (value: string) => {
      searchState.search = value;
    },
    query: searchState.query
  })
}));

vi.mock("fumadocs-core/search/client/orama-static", () => ({
  staticClient: (options: unknown) => {
    calls.staticClient.push(options);
    return { kind: "static-client" };
  }
}));

const i18nState = vi.hoisted(() => ({ locale: "de" as string | undefined }));

vi.mock("fumadocs-ui/contexts/i18n", () => ({
  useI18n: () => ({ locale: i18nState.locale })
}));

import { SearchDialog } from "../../components/search-dialog";

describe("SearchDialog", () => {
  it("builds the static client from the active locale", () => {
    i18nState.locale = "de";
    render(<SearchDialog open={false} onOpenChange={() => {}} />);
    expect(calls.staticClient).toContainEqual({ locale: "de" });
  });

  it("omits the locale key entirely when the site has no locale", () => {
    // `exactOptionalPropertyTypes` forbids writing `locale: undefined`, and the static
    // client treats an absent key and an undefined one differently, so the key must go.
    i18nState.locale = undefined;
    render(<SearchDialog open={false} onOpenChange={() => {}} />);
    expect(calls.staticClient.at(-1)).toEqual({});
    i18nState.locale = "de";
  });

  it("wires the query state into the dialog root", () => {
    searchState.search = "flux";
    searchState.query = { data: [{ id: "1" }], isLoading: true };
    render(<SearchDialog open onOpenChange={() => {}} />);
    const root = calls.root.at(-1);
    expect(root?.search).toBe("flux");
    expect(root?.isLoading).toBe(true);
    // The caller's own dialog props (open / onOpenChange) have to survive the spread.
    expect(root?.open).toBe(true);
    expect(typeof root?.onSearchChange).toBe("function");
  });

  it("passes the result rows to the list", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    searchState.query = { data: rows, isLoading: false };
    render(<SearchDialog open onOpenChange={() => {}} />);
    expect(calls.list.at(-1)?.items).toBe(rows);
  });

  it("hands the list null instead of the empty sentinel", () => {
    searchState.query = { data: "empty", isLoading: false } as unknown as {
      data: unknown[];
      isLoading: boolean;
    };
    render(<SearchDialog open onOpenChange={() => {}} />);
    expect(calls.list.at(-1)?.items).toBeNull();
  });

  it("renders the full dialog chrome", () => {
    searchState.query = { data: [], isLoading: false };
    render(<SearchDialog open onOpenChange={() => {}} />);
    for (const testId of [
      "dialog-root",
      "dialog-overlay",
      "dialog-content",
      "dialog-header",
      "dialog-icon",
      "dialog-input",
      "dialog-close",
      "dialog-list"
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });
});
