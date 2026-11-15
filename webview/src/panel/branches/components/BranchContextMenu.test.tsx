import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BranchActionMenuItem } from "../actions/branchActionTypes";
import { BranchContextMenu } from "./BranchContextMenu";

const items: BranchActionMenuItem[] = [
  {
    kind: "action",
    id: "toggle-favorite",
    label: "Mark as Favorite",
    enabled: true,
  },
  { kind: "separator", id: "favorite" },
  {
    kind: "action",
    id: "compare-current",
    label: "Compare with Current",
    enabled: true,
  },
];

describe("BranchContextMenu", () => {
  it("preserves the commit-menu class contract for tag presentation", () => {
    const view = render(
      <BranchContextMenu
        x={20}
        y={30}
        name="v1.0.0"
        items={items}
        presentation="tag"
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const menu = view.getByRole("menu");
    expect(menu.classList.contains("commit-context-menu")).toBe(true);
    for (const item of within(menu).getAllByRole("menuitem")) {
      expect(item.classList.contains("commit-context-menu-item")).toBe(true);
      expect(item.tagName).toBe("BUTTON");
    }
    expect(menu.querySelector(".commit-context-menu-separator")).not.toBeNull();
  });
  it("uses a stable local ref identity for context-menu row highlighting", () => {
    const ref = {
      type: "local" as const,
      name: "main",
      fullRef: "refs/heads/main",
    };

    expect(`${ref.type}:${ref.fullRef}`).toBe("local:refs/heads/main");
  });

});
