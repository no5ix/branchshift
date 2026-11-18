import type { BranchInfo } from "../../../shared/types/git";
import type {
  BranchActionAvailability,
  BranchActionContext,
  BranchActionId,
  BranchActionMenuItem,
} from "./branchActionTypes";

const branchMenu: readonly (BranchActionId | { separator: string })[] = [
  "update",
  "push",
  "copy-branch-name",
  { separator: "sync" },
  "checkout",
  "new-branch",
  "compare-current",
  "checkout-rebase",
  { separator: "integrate" },
  "rebase-current",
  "merge-current",
  { separator: "manage" },
  "rename",
  "delete",
  "delete-local-and-remote",
  { separator: "favorite" },
  "toggle-favorite",
];

const tagMenu: readonly (BranchActionId | { separator: string })[] = [
  "compare-current",
  { separator: "favorite" },
  "toggle-favorite",
];

export function resolveDeleteTargets(
  selectedBranches: readonly BranchInfo[],
  allBranches: readonly BranchInfo[],
  currentBranch: string,
): BranchInfo[] {
  const candidates = [
    ...selectedBranches,
    ...selectedBranches
      .map((candidate) =>
        candidate.isRemote
          ? allBranches.find(
              (possibleLocal) =>
                !possibleLocal.isRemote &&
                possibleLocal.upstream === candidate.name,
            )
          : candidate.upstream
            ? allBranches.find(
                (possibleRemote) =>
                  possibleRemote.isRemote &&
                  possibleRemote.name === candidate.upstream,
              )
            : undefined,
      )
      .filter((candidate): candidate is BranchInfo => candidate !== undefined),
  ];

  return candidates.filter(
    (candidate, index, all) =>
      (candidate.isRemote ||
        (!candidate.isCurrent && candidate.name !== currentBranch)) &&
      all.findIndex((item) => item.fullRef === candidate.fullRef) === index,
  );
}

export function getBranchActionAvailability(
  id: BranchActionId,
  context: BranchActionContext,
): BranchActionAvailability {
  if (context.tag) {
    const visible = id === "toggle-favorite" || id === "compare-current";
    return { visible, enabled: visible };
  }

  const branch = context.branch;
  if (!branch) return { visible: false, enabled: false };

  const current = branch.name === context.currentBranch;
  if (
    id === "toggle-favorite" ||
    id === "new-branch" ||
    id === "copy-branch-name"
  ) {
    return { visible: true, enabled: true };
  }
  if (id === "compare-current") {
    return branch.isCurrent && !branch.isRemote
      ? {
          visible: true,
          enabled: false,
          disabledReason: "Already checked out",
        }
      : { visible: true, enabled: true };
  }
  if (
    id === "checkout" ||
    id === "checkout-rebase" ||
    id === "rebase-current" ||
    id === "merge-current" ||
    id === "delete"
  ) {
    return { visible: !current, enabled: !current };
  }
  if (id === "delete-local-and-remote") {
    const enabled = !current || branch.isRemote;
    return { visible: true, enabled };
  }
  if (id === "rename") {
    const visible = !branch.isRemote;
    return { visible, enabled: visible };
  }
  if (id === "update") {
    if (branch.isRemote) return { visible: false, enabled: false };
    return branch.upstream
      ? { visible: true, enabled: true }
      : {
          visible: true,
          enabled: false,
          disabledReason: "No upstream configured",
        };
  }

  const visible = id === "push" && !branch.isRemote;
  return { visible, enabled: visible };
}

export function getBranchActionItems(
  context: BranchActionContext,
): BranchActionMenuItem[] {
  const catalog = context.tag ? tagMenu : branchMenu;
  const items: BranchActionMenuItem[] = [];

  for (const descriptor of catalog) {
    if (typeof descriptor !== "string") {
      items.push({ kind: "separator", id: descriptor.separator });
      continue;
    }

    const availability = getBranchActionAvailability(descriptor, context);
    if (!availability.visible) continue;
    items.push({
      kind: "action",
      id: descriptor,
      label: getLabel(descriptor, context),
      enabled: availability.enabled,
      ...(availability.disabledReason
        ? { disabledReason: availability.disabledReason }
        : {}),
    });
  }

  return removeOrphanedSeparators(items);
}

function getLabel(id: BranchActionId, context: BranchActionContext): string {
  const branch = context.branch;
  const favorite = branch?.isFavorite ?? context.tag?.isFavorite ?? false;
  switch (id) {
    case "toggle-favorite":
      return favorite ? "Unmark as Favorite" : "Mark as Favorite";
    case "checkout":
      return "Checkout";
    case "new-branch":
      return `New Branch from '${branch?.name ?? context.ref.name}'...`;
    case "compare-current":
      return "Compare with Current";
    case "checkout-rebase":
      return `Checkout and Rebase onto '${context.currentBranch}'`;
    case "rebase-current":
      return `Rebase '${context.currentBranch}' onto '${branch?.name ?? context.ref.name}'`;
    case "merge-current":
      return `Merge '${branch?.name ?? context.ref.name}' into '${context.currentBranch}'`;
    case "rename":
      return "Rename...";
    case "delete":
      return context.selectedBranches && context.selectedBranches.length > 1
        ? `Delete ${context.selectedBranches.length} Branches`
        : "Delete";
    case "delete-local-and-remote":
      return context.deleteSelectionCount && context.deleteSelectionCount > 1
        ? `Delete Local and Remote ${context.deleteSelectionCount} Branches`
        : "Delete Local and Remote";
    case "update":
      return "Update";
    case "push":
      return "Push...";
    case "copy-branch-name":
      return "Copy Branch Name";
  }
}

function removeOrphanedSeparators(
  items: readonly BranchActionMenuItem[],
): BranchActionMenuItem[] {
  const normalized: BranchActionMenuItem[] = [];
  let pendingSeparator: BranchActionMenuItem | undefined;
  for (const item of items) {
    if (item.kind === "separator") {
      pendingSeparator = item;
      continue;
    }
    if (pendingSeparator && normalized.length > 0) {
      normalized.push(pendingSeparator);
    }
    pendingSeparator = undefined;
    normalized.push(item);
  }
  return normalized;
}
