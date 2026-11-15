import { Tooltip } from "../../shared/components/Tooltip";
import { usePreventSelect } from "../../shared/hooks/usePreventSelect";
import { useGitLogStore } from "../../shared/store/git-log-store-context";
import type { Commit, LaneInfo, RefInfo } from "../../shared/types/git";

export const ROW_HEIGHT = 28;
export const COMMIT_COLUMN_GUTTER_WIDTH = 9;
const COLUMN_WIDTH = 10;
const GRAPH_PADDING = 6;
const NODE_TEXT_GAP = 14;

export function getCommitMessageOffset(maxColumn: number): number {
  return GRAPH_PADDING + (maxColumn + 1) * COLUMN_WIDTH + NODE_TEXT_GAP;
}

/** Tag icon colors matching IDEA */
const REF_ICON_COLORS: Record<string, string> = {
  branch: "#59a869",
  "remote-branch": "#b07cd8",
  tag: "#e5c07b",
  HEAD: "#c75450",
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function buildRefDisplayItems(refs: RefInfo[]): Array<{
  key: string;
  type: RefInfo["type"];
  label: string;
}> {
  const hasHead = refs.some((ref) => ref.type === "HEAD");
  const branchRef = refs.find((ref) => ref.type === "branch");
  const result: Array<{ key: string; type: RefInfo["type"]; label: string }> =
    [];

  const localBranches = refs
    .filter((ref) => ref.type === "branch")
    .map((ref) => ref.name);
  const remoteBranches = refs
    .filter(
      (ref) => ref.type === "remote-branch" && !ref.name.endsWith("/HEAD"),
    )
    .map((ref) => ref.name);
  const tags = refs.filter((ref) => ref.type === "tag").map((ref) => ref.name);

  const displayNames: string[] = [];
  const usedRemotes = new Set<string>();
  const usedLocals = new Set<string>();
  for (const local of localBranches) {
    const matchingRemotes = remoteBranches.filter((remoteRef) => {
      const slash = remoteRef.indexOf("/");
      return slash >= 0 && remoteRef.slice(slash + 1) === local;
    });
    for (const remoteRef of matchingRemotes) {
      const remote = remoteRef.slice(0, remoteRef.indexOf("/"));
      displayNames.push(`${remote} & ${local}`);
      usedRemotes.add(remoteRef);
      usedLocals.add(local);
    }
  }

  for (const local of localBranches) {
    if (usedLocals.has(local)) continue;
    if (hasHead && branchRef?.name === local) continue;
    displayNames.push(local);
  }
  for (const remoteRef of remoteBranches) {
    if (!usedRemotes.has(remoteRef)) displayNames.push(remoteRef);
  }

  if (hasHead) {
    result.push({ key: "HEAD", type: "HEAD", label: "" });
    if (branchRef && !usedLocals.has(branchRef.name)) {
      displayNames.unshift(branchRef.name);
    }
  }

  const isMainRefDisplayName = (name: string) =>
    name === "main" || name.endsWith("/main") || name.endsWith(" & main");
  displayNames.sort(
    (a, b) => Number(isMainRefDisplayName(b)) - Number(isMainRefDisplayName(a)),
  );

  for (const name of displayNames) {
    if (name.includes(" & ")) {
      result.push({ key: `remote:${name}`, type: "remote-branch", label: "" });
      result.push({ key: `branch:${name}`, type: "branch", label: name });
    } else if (name.includes("/")) {
      result.push({
        key: `remote:${name}`,
        type: "remote-branch",
        label: name,
      });
    } else {
      result.push({ key: `branch:${name}`, type: "branch", label: name });
    }
  }

  for (const tag of tags) {
    result.push({ key: `tag:${tag}`, type: "tag", label: tag });
  }
  return result;
}

export interface ColumnWidths {
  author: number;
  date: number;
  hash: number;
}

export interface VisibleColumns {
  author: boolean;
  date: boolean;
  hash: boolean;
}

function ColumnGutter() {
  return (
    <span
      aria-hidden="true"
      data-commit-column-gutter
      style={{ width: COMMIT_COLUMN_GUTTER_WIDTH, flexShrink: 0 }}
    />
  );
}

export function CommitRow({
  commit,
  lane,
  rowMaxColumn,
  columnWidths,
  visibleColumns,
  onCommitClick,
  onContextMenu,
}: {
  commit: Commit;
  lane: LaneInfo | undefined;
  rowMaxColumn: number;
  columnWidths: ColumnWidths;
  visibleColumns?: VisibleColumns;
  onCommitClick: (event: React.MouseEvent, hash: string) => void;
  onContextMenu?: (event: React.MouseEvent, commit: Commit) => void;
}) {
  const selectedCommitHashes = useGitLogStore((s) => s.selectedCommitHashes);
  const setHoveredColumn = useGitLogStore((s) => s.setHoveredColumn);
  const rowRef = usePreventSelect<HTMLDivElement>();

  const isSelected = selectedCommitHashes.includes(commit.hash);
  const col = lane?.column ?? 0;
  const refItems = buildRefDisplayItems(commit.refs);

  return (
    <div
      ref={rowRef}
      className={`commit-row selectable-row${commit.reachableFromCurrent ? " current-reachable" : ""}${isSelected ? " selected" : ""}`}
      onClick={(event) => onCommitClick(event, commit.hash)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, commit);
        }
      }}
      onMouseEnter={() => setHoveredColumn(col)}
      onMouseLeave={() => setHoveredColumn(null)}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        paddingLeft: getCommitMessageOffset(rowMaxColumn),
        paddingRight: 8,
        color: isSelected ? "var(--selected-fg)" : "inherit",
      }}
    >
      {/* Subject + refs column (flex) */}
      <span
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          paddingRight: 8,
          gap: 6,
        }}
      >
        <span
          style={{
            flexShrink: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Tooltip text={commit.subject} onlyWhenTruncated>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {commit.subject}
            </span>
          </Tooltip>
        </span>
        {refItems.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              marginLeft: "auto",
              paddingLeft: 8,
            }}
          >
            {/* Overlapping outline tag icons */}
            <span
              style={{
                display: "inline-flex",
                position: "relative",
                width: 16 + Math.max(0, (refItems.length - 1) * 5),
                height: 16,
              }}
            >
              {refItems.map((item, idx) => {
                const color =
                  REF_ICON_COLORS[item.type] ?? REF_ICON_COLORS.branch;
                return (
                  <svg
                    key={item.key}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{ position: "absolute", left: idx * 5, top: 0 }}
                  >
                    <path
                      d="M2.5 3.5C2.5 2.95 2.95 2.5 3.5 2.5H7.09c.27 0 .52.1.71.3l5.41 5.41c.39.39.39 1.02 0 1.41l-3.59 3.59c-.39.39-1.02.39-1.41 0L2.79 7.8a1 1 0 01-.29-.71V3.5z"
                      fill="var(--app-bg, #fff)"
                      stroke={color}
                      strokeWidth="1.2"
                    />
                    <circle cx="5" cy="5" r="0.9" fill={color} />
                  </svg>
                );
              })}
            </span>
            {/* Text labels (skip HEAD text) */}
            {(() => {
              const labels = refItems
                .filter((item) => item.type !== "HEAD" && item.label)
                .map((item) => item.label);
              const displayLabel = labels.join(", ");
              return (
                <Tooltip text={displayLabel}>
                  <span
                    style={{
                      fontSize: "0.8em",
                      whiteSpace: "nowrap",
                      opacity: 0.85,
                    }}
                  >
                    {displayLabel}
                  </span>
                </Tooltip>
              );
            })()}
          </span>
        )}
      </span>

      {/* Author column */}
      {visibleColumns?.author !== false && (
        <>
          <ColumnGutter />
          <span
            style={{
              flexShrink: 0,
              width: columnWidths.author,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: 0.7,
              paddingLeft: 8,
            }}
          >
            {commit.authorName}
          </span>
        </>
      )}

      {/* Date column */}
      {visibleColumns?.date !== false && (
        <>
          <ColumnGutter />
          <span
            style={{
              flexShrink: 0,
              width: columnWidths.date,
              textAlign: "left",
              opacity: 0.5,
              paddingLeft: 8,
            }}
          >
            {formatDateTime(commit.authorDate)}
          </span>
        </>
      )}

      {/* Hash column */}
      {visibleColumns?.hash !== false && (
        <>
          <ColumnGutter />
          <span
            style={{
              flexShrink: 0,
              width: columnWidths.hash,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: 0.5,
              paddingLeft: 8,
              fontFamily: "monospace",
              fontSize: "0.9em",
            }}
          >
            {commit.shortHash}
          </span>
        </>
      )}
    </div>
  );
}
