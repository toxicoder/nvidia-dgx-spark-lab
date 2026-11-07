import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { LegacyHashMigrator, legacyHashToSlug } from "@/components/LegacyHashMigrator";

const replace = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname
}));

describe("legacyHashToSlug", () => {
  it("maps an old anchor to its new route slug", () => {
    expect(legacyHashToSlug("#storage")).toBe("storage");
    expect(legacyHashToSlug("agent-chat")).toBe("agent-chat");
  });

  it("leaves the skip-link target alone", () => {
    expect(legacyHashToSlug("#main")).toBeUndefined();
  });

  it("ignores an empty hash", () => {
    expect(legacyHashToSlug("")).toBeUndefined();
    expect(legacyHashToSlug("#")).toBeUndefined();
  });

  it("ignores a hash that is not a section", () => {
    expect(legacyHashToSlug("#not-a-section")).toBeUndefined();
  });
});

describe("LegacyHashMigrator", () => {
  beforeEach(() => {
    replace.mockClear();
    pathname = "/";
    window.location.hash = "";
  });

  it("redirects a bookmarked /#section to its route", () => {
    window.location.hash = "#utilities";
    render(<LegacyHashMigrator />);
    expect(replace).toHaveBeenCalledWith("/utilities");
  });

  it("renders nothing", () => {
    render(<LegacyHashMigrator />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("stays put when there is no hash", () => {
    render(<LegacyHashMigrator />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("stays put when the hash is not a section", () => {
    window.location.hash = "#whatever";
    render(<LegacyHashMigrator />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing on a section route, where a hash is just a fragment", () => {
    pathname = "/storage";
    window.location.hash = "#treemap";
    render(<LegacyHashMigrator />);
    expect(replace).not.toHaveBeenCalled();
  });
});
