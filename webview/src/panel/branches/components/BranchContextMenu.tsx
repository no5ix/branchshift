import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  BranchActionId,
  BranchActionMenuItem,
} from "../actions/branchActionTypes";

export interface BranchContextMenuProps {
  x: number;
  y: number;
  name: string;
  items: readonly BranchActionMenuItem[];
  presentation: "branch" | "tag";
  onAction(id: BranchActionId): void;
  onClose(): void;
}

export function BranchContextMenu({
  x,
  y,
  name,
  items,
  presentation,
  onAction,
  onClose,
}: BranchContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });
  const isTagPresentation = presentation === "tag";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      const availableHeight = Math.max(0, window.innerHeight - 8);
      const contentHeight = Math.min(menu.scrollHeight, availableHeight);
      const bottom = window.innerHeight - 4;
      const top =
        y + contentHeight > bottom
          ? Math.max(4, bottom - contentHeight)
          : Math.max(4, y);
      let left = x;
      if (left + rect.width > window.innerWidth) {
        left = Math.max(4, window.innerWidth - rect.width - 4);
      }
      setPosition({ top, left });
    });
    return () => cancelAnimationFrame(frame);
  }, [x, y]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeOnBlur = () => onClose();
    const closeOnScroll = (event: Event) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", closeOutside, true);
    document.addEventListener("contextmenu", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeOnBlur);
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnBlur);
    return () => {
      document.removeEventListener("mousedown", closeOutside, true);
      document.removeEventListener("contextmenu", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", closeOnBlur);
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnBlur);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${name}`}
      className={isTagPresentation ? "commit-context-menu" : undefined}
      style={
        isTagPresentation
          ? {
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: 9999,
              maxHeight: `calc(100vh - ${position.top}px - 8px)`,
              overflowY: "auto",
            }
          : {
              position: "fixed",
              top: position.top,
              left: position.left,
              zIndex: 9999,
              background: "var(--vscode-menu-background, #1e1e1e)",
              border: "1px solid var(--vscode-menu-border, #454545)",
              borderRadius: 4,
              padding: "4px 0",
              display: "inline-grid",
              gridTemplateColumns: "max-content",
              width: "max-content",
              minWidth: 160,
              maxWidth: "calc(100vw - 8px)",
              boxSizing: "border-box",
              maxHeight: `calc(100vh - ${position.top}px - 8px)`,
              overflowY: "auto",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }
      }
    >
      {items.map((item) =>
        item.kind === "separator" ? (
          <div
            key={`separator:${item.id}`}
            className={
              isTagPresentation ? "commit-context-menu-separator" : undefined
            }
            style={
              isTagPresentation
                ? undefined
                : {
                    height: 1,
                    background:
                      "var(--vscode-menu-separatorBackground, #454545)",
                    margin: "4px 0",
                  }
            }
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={
              isTagPresentation ? "commit-context-menu-item" : undefined
            }
            tabIndex={0}
            aria-label={item.label}
            aria-disabled={!item.enabled || undefined}
            aria-description={item.disabledReason}
            title={item.disabledReason}
            onClick={() => {
              if (item.enabled) onAction(item.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (item.enabled) onAction(item.id);
            }}
            style={
              isTagPresentation
                ? {
                    cursor: item.enabled ? "pointer" : "default",
                    opacity: item.enabled ? 1 : 0.5,
                  }
                : {
                    display: "block",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    border: 0,
                    padding: "6px 16px",
                    background: "transparent",
                    borderRadius: 0,
                    cursor: item.enabled ? "pointer" : "default",
                    opacity: item.enabled ? 1 : 0.5,
                    color: "var(--vscode-menu-foreground, #ccc)",
                    font: "inherit",
                    fontSize: "13px",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }
            }
            onMouseEnter={(event) => {
              if (!isTagPresentation && item.enabled) {
                event.currentTarget.style.background =
                  "var(--vscode-list-hoverBackground, #2a2d2e)";
                event.currentTarget.style.color =
                  "var(--vscode-menu-selectionForeground, #fff)";
              }
            }}
            onMouseLeave={(event) => {
              if (isTagPresentation) return;
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.color =
                "var(--vscode-menu-foreground, #ccc)";
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
