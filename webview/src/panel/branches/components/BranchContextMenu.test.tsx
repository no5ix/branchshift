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
  it("sizes the branch menu to its longest item without stretching across the panel", () => {
    const view = render(
      <BranchContextMenu
        x={20}
        y={30}
        name="feature/example"
        items={[
          {
            kind: "action",
            id: "long-action",
            label: "Checkout and Rebase onto 'origin/feature/example'",
            enabled: true,
          },
          {
            kind: "action",
            id: "short-action",
            label: "Checkout",
            enabled: true,
          },
        ]}
        presentation="branch"
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const menu = view.getByRole("menu") as HTMLElement;
    expect(menu.parentElement).toBe(document.body);
    const action = within(menu).getByRole("menuitem", {
      name: "Checkout",
    }) as HTMLButtonElement;
    expect(menu.style.display).toBe("inline-grid");
    expect(menu.style.gridTemplateColumns).toBe("max-content");
    expect(menu.style.width).toBe("max-content");
    expect(menu.style.maxWidth).toBe("calc(100vw - 8px)");
    expect(action.style.width).toBe("100%");
    expect(action.style.maxWidth).toBe("100%");
    expect(action.style.display).toBe("block");
    expect(action.style.boxSizing).toBe("border-box");
  });
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
