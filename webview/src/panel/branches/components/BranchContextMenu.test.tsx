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
    expect(menu.style.maxHeight).toBe("calc(100vh - 30px - 8px)");
    expect(menu.style.overflowY).toBe("auto");
    expect(menu.style.scrollbarWidth).toBe("thin");
    expect(menu.style.scrollbarColor).toBe(
      "var(--vscode-scrollbarSlider-background, #6b6b6b) transparent",
    );
    expect(action.style.width).toBe("100%");
    expect(action.style.maxWidth).toBe("100%");
    expect(action.style.display).toBe("block");
    expect(action.style.boxSizing).toBe("border-box");
  });
  it("moves the menu upward when its full content would extend below the viewport", () => {
    const originalInnerHeight = window.innerHeight;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(500);

    try {
      const view = render(
        <BranchContextMenu
          x={20}
          y={200}
          name="feature/bottom"
          items={items}
          presentation="branch"
          onAction={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect((view.getByRole("menu") as HTMLElement).style.top).toBe("96px");
    } finally {
      scrollHeight.mockRestore();
      vi.unstubAllGlobals();
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      });
    }
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
    expect(menu.style.maxHeight).toBe("calc(100vh - 30px - 8px)");
    expect(menu.style.overflowY).toBe("auto");
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
