/**
 * Tests for the site chrome provider.
 *
 * `Provider` is the single place the docs chrome gets its theme and search wiring.  Two
 * details matter to a reader of the exported (static) build: the theme has to drive the
 * `.dark` class that the Voltage token block in `app/global.css` keys off - an attribute
 * flip rather than an inline style, because the export has no script to restyle - and the
 * search context has to receive the site's own `SearchDialog`, which is what swaps the
 * default server-backed dialog for the static Orama/ZBSearch client.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const rootProviderProps = vi.hoisted(() => ({ current: undefined as Record<string, unknown> | undefined }));
const searchDialogStub = vi.hoisted(() => () => null);

vi.mock("fumadocs-ui/provider/next", () => ({
  RootProvider: (props: { children?: React.ReactNode } & Record<string, unknown>) => {
    rootProviderProps.current = props;
    return <div data-testid="root-provider">{props.children}</div>;
  }
}));

vi.mock("@/components/search-dialog", () => ({
  SearchDialog: searchDialogStub
}));

import { Provider } from "../../components/provider";

describe("Provider", () => {
  it("drives the theme through the class attribute so the static export can restyle", () => {
    render(
      <Provider>
        <p>page</p>
      </Provider>
    );
    expect(rootProviderProps.current?.theme).toEqual({ attribute: "class", defaultTheme: "system" });
  });

  it("hands the static search dialog to the search context", () => {
    render(
      <Provider>
        <p>page</p>
      </Provider>
    );
    const search = rootProviderProps.current?.search as { SearchDialog?: unknown };
    expect(search.SearchDialog).toBe(searchDialogStub);
  });

  it("renders its children inside the provider", () => {
    render(
      <Provider>
        <p>the page body</p>
      </Provider>
    );
    expect(screen.getByTestId("root-provider")).toHaveTextContent("the page body");
  });
});
