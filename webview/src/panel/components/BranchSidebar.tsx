import { useCallback, useRef, useState } from "react";
import CodiconListFlat from "~icons/codicon/list-flat";
import CodiconListTree from "~icons/codicon/list-tree";
import { Tooltip } from "../../shared/components/Tooltip";
import "../../shared/components/Tooltip.css";
import { useGitLogStore } from "../../shared/store/git-log-store-context";
import type { PanelStore } from "../../shared/store/panel-store";
import type { GitRefIdentity } from "../../shared/types/git";
import {
  type BranchActionUi,
  formatBranchActionError,
  notifyBranchActionErrorIfCurrent,
} from "../branches/actions/branchActionRunner";
import { useBranchOperations } from "../branches/branchOperations";
import { refKey } from "../utils/refUtils";

export function BranchSidebar({
  onTogglePanel,
}: {
  onTogglePanel?: () => void;
} = {}) {
  const selectedRefs = useGitLogStore((s) => s.selectedRefs);
  const branches = useGitLogStore((s) => s.branches);
  const tags = useGitLogStore((s) => s.tags);
  const actionRepoId = useGitLogStore((s) => s.actionRepoId);
  const requestFromSurface = useGitLogStore((s) => s.requestFromSurface);
  const navigateToRef = useGitLogStore((s) => s.navigateToRef);
  const operations = useBranchOperations();
  const selectedRef = selectedRefs.length === 1 ? selectedRefs[0] : null;
  const selectedBranch = selectedRef
    ? branches.find(
        (branch) =>
          branch.name === selectedRef.name &&
          (branch.isRemote ? "remote" : "local") === selectedRef.type,
      )
    : undefined;
  const selectedTag =
    selectedRef?.type === "tag"
      ? tags.find((tag) => tag.name === selectedRef.name)
      : undefined;
  const selectedTargetHash =
    selectedBranch?.lastCommitHash ?? selectedTag?.targetCommitHash;
  const latestSelectedRef = useRef(selectedRef);
  latestSelectedRef.current = selectedRef;
  const isActionCurrent = useCallback(
    (repoId: string, ref?: GitRefIdentity) => {
      if (actionRepoId() !== repoId) return false;
      if (!ref) return true;
      const currentRef = latestSelectedRef.current;
      return currentRef !== null && refKey(currentRef) === refKey(ref);
    },
    [actionRepoId],
  );

  const handleFetch = useCallback(async () => {
    const repoId = actionRepoId();
    if (!repoId) return;
    await runSidebarAction(
      () => operations.fetch(repoId),
      "Fetch failed",
      { repoId },
      isActionCurrent,
      requestFromSurface,
    );
  }, [actionRepoId, isActionCurrent, operations, requestFromSurface]);

  const handleNavigateToHead = useCallback(async () => {
    if (!selectedRef || !selectedTargetHash) return;
    await navigateToRef(selectedRef, selectedTargetHash);
  }, [navigateToRef, selectedRef, selectedTargetHash]);

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
      <Tooltip text="Fetch">
        <button
          type="button"
          className="branch-sidebar-btn"
          aria-label="Fetch"
          onClick={handleFetch}
          disabled={!actionRepoId()}
        >
          <IconFetch />
        </button>
      </Tooltip>
      <Tooltip text="Navigate Log to Selected Ref Head">
        <button
          type="button"
          className="branch-sidebar-btn"
          aria-label="Navigate Log to Selected Ref Head"
          onClick={handleNavigateToHead}
          disabled={!selectedRef || !selectedTargetHash}
        >
          <IconLocate />
        </button>
      </Tooltip>
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

async function runSidebarAction(
  operation: () => Promise<void>,
  title: string,
  context: { repoId: string; ref?: GitRefIdentity },
  isCurrent: BranchActionUi["isCurrent"],
  request: PanelStore["requestFromSurface"],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const formatted = formatBranchActionError(error);
    if (formatted.code === "STALE_RESPONSE") return;
    await notifyBranchActionErrorIfCurrent(title, formatted, context, {
      isCurrent,
      notifyError: (errorTitle, currentError) =>
        notifyActionError(request, errorTitle, currentError),
    });
  }
}

async function notifyActionError(
  request: PanelStore["requestFromSurface"],
  title: string,
  error: Parameters<BranchActionUi["notifyError"]>[1],
): Promise<void> {
  const recovery = error.recovery ? `\n${error.recovery}` : "";
  await request(
    "showErrorNotification",
    { message: `${title}: ${error.message}${recovery}` },
    { scope: "global" },
  );
}

/* ─── JetBrains Official Icons (Apache 2.0) ──────────────────────── */

/** expui/vcs/fetch.svg */
function IconFetch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M12.8536 3.14645C13.0488 3.34171 13.0488 3.65829 12.8536 3.85355L11.4393 5.26777C11.2441 5.46303 10.9275 5.46303 10.7322 5.26777C10.537 5.0725 10.537 4.75592 10.7322 4.56066L12.1464 3.14645C12.3417 2.95118 12.6583 2.95118 12.8536 3.14645Z"
        fill="currentColor"
      />
      <path
        d="M10.0251 5.97487C10.2204 6.17014 10.2204 6.48672 10.0251 6.68198L8.61091 8.09619C8.41565 8.29146 8.09907 8.29146 7.90381 8.09619C7.70854 7.90093 7.70854 7.58435 7.90381 7.38909L9.31802 5.97487C9.51328 5.77961 9.82986 5.77961 10.0251 5.97487Z"
        fill="currentColor"
      />
      <path
        d="M7.1967 8.8033C7.39196 8.99856 7.39196 9.31515 7.1967 9.51041L5.78249 10.9246C5.58722 11.1199 5.27064 11.1199 5.07538 10.9246C4.88012 10.7294 4.88012 10.4128 5.07538 10.2175L6.48959 8.8033C6.68485 8.60804 7.00144 8.60804 7.1967 8.8033Z"
        fill="currentColor"
      />
      <path
        d="M3.5 5C3.77614 5 4 5.22386 4 5.5V7.5C4 7.77614 3.77614 8 3.5 8C3.22386 8 3 7.77614 3 7.5V5.5C3 5.22386 3.22386 5 3.5 5Z"
        fill="currentColor"
      />
      <path
        d="M3.5 9C3.77614 9 4 9.22386 4 9.5V12H6.5C6.77614 12 7 12.2239 7 12.5C7 12.7761 6.77614 13 6.5 13H3.5C3.22386 13 3 12.7761 3 12.5V9.5C3 9.22386 3.22386 9 3.5 9Z"
        fill="currentColor"
      />
      <path
        d="M8 12.5C8 12.2239 8.22386 12 8.5 12H10.5C10.7761 12 11 12.2239 11 12.5C11 12.7761 10.7761 13 10.5 13H8.5C8.22386 13 8 12.7761 8 12.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** expui/general/locate.svg */
function IconLocate() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.5 5V2.02054C11.4149 2.26101 13.739 4.5851 13.9795 7.5H11C10.7239 7.5 10.5 7.72386 10.5 8C10.5 8.27614 10.7239 8.5 11 8.5H13.9795C13.739 11.4149 11.4149 13.739 8.5 13.9795V11C8.5 10.7239 8.27614 10.5 8 10.5C7.72386 10.5 7.5 10.7239 7.5 11V13.9795C4.5851 13.739 2.26101 11.4149 2.02054 8.5H5C5.27614 8.5 5.5 8.27614 5.5 8C5.5 7.72386 5.27614 7.5 5 7.5H2.02054C2.26101 4.5851 4.5851 2.26101 7.5 2.02054V5C7.5 5.27614 7.72386 5.5 8 5.5C8.27614 5.5 8.5 5.27614 8.5 5ZM1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
