import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../ui/dropdown-menu";

describe("DropdownMenu", () => {
  it("renders the trigger as a button", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Row actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Reveal</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByRole("button", { name: "Row actions" })).toBeInTheDocument();
  });

  it("renders an open menu with labelled items and a separator", () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Row actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-testid="menu">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Secret</DropdownMenuLabel>
            <DropdownMenuItem data-testid="item-reveal">Reveal value</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="item-delete">Delete</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByTestId("menu")).toBeInTheDocument();
    expect(screen.getByText("Secret")).toBeInTheDocument();
    expect(screen.getByTestId("item-reveal").textContent).toContain("Reveal value");
    expect(screen.getByTestId("item-delete").textContent).toContain("Delete");
  });

  it("selecting an item calls back", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Row actions</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Stop</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    fireEvent.click(screen.getByText("Stop"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("accepts a className on the content", () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="p-1">
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText("One").closest("[data-slot='dropdown-menu-content']")?.className).toContain("p-1");
  });
});
