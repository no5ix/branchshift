import { useCallback, useRef, useState } from "react";
import CodiconListFlat from "~icons/codicon/list-flat";
import CodiconListTree from "~icons/codicon/list-tree";
import { Tooltip } from "../../shared/components/Tooltip";
import "../../shared/components/Tooltip.css";
import { useGitLogStore } from "../../shared/store/git-log-store-context";

export function BranchSidebar({
  onTogglePanel,
}: {
  onTogglePanel?: () => void;
} = {}) {
  const branchGroupByDirectory = useGitLogStore(
    (s) => s.branchGroupByDirectory,
  );
  const toggleBranchGroupByDirectory = useGitLogStore(
    (s) => s.toggleBranchGroupByDirectory,
  );

  const handleExpandAll = useCallback(() => {
    window.dispatchEvent(new CustomEvent("branch-tree-expand-all"));
  }, []);

  const handleCollapseAll = useCallback(() => {
    window.dispatchEvent(new CustomEvent("branch-tree-collapse-all"));
  }, []);

  return (
    <div className="branch-sidebar">
      {onTogglePanel && (
        <Tooltip text="Hide Branches">
          <button
            type="button"
            className="branch-sidebar-btn"
            onClick={onTogglePanel}
          >
            <IconCollapsePanel />
          </button>
        </Tooltip>
      )}
      <SettingsButton />
      <Tooltip
        text={branchGroupByDirectory ? "Flatten List" : "Group By Directory"}
      >
        <button
          type="button"
          className={`branch-sidebar-btn${branchGroupByDirectory ? " active" : ""}`}
          aria-label={
            branchGroupByDirectory ? "Flatten List" : "Group By Directory"
          }
          onClick={toggleBranchGroupByDirectory}
        >
          {branchGroupByDirectory ? <CodiconListFlat /> : <CodiconListTree />}
        </button>
      </Tooltip>

      <div className="branch-sidebar-spacer" />

      <Tooltip text="Expand All">
        <button
          type="button"
          className="branch-sidebar-btn"
          onClick={handleExpandAll}
        >
          <IconExpandAll />
        </button>
      </Tooltip>
      <Tooltip text="Collapse All">
        <button
          type="button"
          className="branch-sidebar-btn"
          onClick={handleCollapseAll}
        >
          <IconCollapseAll />
        </button>
      </Tooltip>
    </div>
  );
}

/* ─── Settings Button with Dropdown ──────────────────────────────── */

function SettingsButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Tooltip text="Settings">
        <button
          type="button"
          className="branch-sidebar-btn"
          aria-label="Branch Settings"
          ref={btnRef}
          onClick={() => setOpen(!open)}
        >
          <IconSettings />
        </button>
      </Tooltip>
      {open && <SettingsMenu onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsMenu({ onClose }: { onClose: () => void }) {
  const showTags = useGitLogStore((state) => state.showTags);
  const singleClickAction = useGitLogStore((state) => state.singleClickAction);
  const setPreferences = useGitLogStore(
    (state) => state.setBranchDashboardPreferences,
  );
  const menuRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const handleClick = (e: MouseEvent) => {
        if (!node.contains(e.target as Node)) onClose();
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleClick);
        document.removeEventListener("keydown", handleKey);
      };
    },
    [onClose],
  );

  return (
    <div
      ref={menuRef}
      className="commit-context-menu"
      style={{
        position: "fixed",
        left: 40,
        top: "50%",
        zIndex: 1000,
      }}
    >
      <div className="commit-context-menu-header">On Single Click</div>
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={() => {
          void setPreferences({ singleClickAction: "filter" });
          onClose();
        }}
      >
        <span>
          {singleClickAction === "filter" ? "✓ " : ""}Update Branch Filter
        </span>
      </button>
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={() => {
          void setPreferences({ singleClickAction: "navigate" });
          onClose();
        }}
      >
        <span>
          {singleClickAction === "navigate" ? "✓ " : ""}Navigate Log to Ref Head
        </span>
      </button>
      <div className="commit-context-menu-separator" />
      <button
        type="button"
        className="commit-context-menu-item"
        onClick={() => {
          void setPreferences({ showTags: !showTags });
          onClose();
        }}
      >
        <span>{showTags ? "✓ " : ""}Show Tags</span>
      </button>
    </div>
  );
}

/* ─── JetBrains Official Icons (Apache 2.0) ──────────────────────── */

/** expui/general/settings.svg – stroke-based gear */
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6.5 1.5H9.5L10 3.5L12 4.5L14 3.5L15 6L13.5 7.5V8.5L15 10L14 12.5L12 11.5L10 12.5L9.5 14.5H6.5L6 12.5L4 11.5L2 12.5L1 10L2.5 8.5V7.5L1 6L2 3.5L4 4.5L6 3.5L6.5 1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" />
    </svg>
  );
}

/** Based on expui/general/chevronUp.svg (doubled for expand all) */
function IconExpandAll() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4.5 9L8 5.5L11.5 9"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M4.5 13L8 9.5L11.5 13"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Based on expui/general/chevronDown.svg (doubled for collapse all) */
function IconCollapseAll() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.5 7L8 10.5L4.5 7"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <path
        d="M11.5 3L8 6.5L4.5 3"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Collapse panel – left-pointing chevron */
function IconCollapsePanel() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 4.5L6.5 8L10 11.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
