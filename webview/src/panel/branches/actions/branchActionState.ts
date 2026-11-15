import type {
  BranchActionAvailability,
  BranchActionContext,
  BranchActionId,
  BranchActionMenuItem,
} from "./branchActionTypes";

const branchMenu: readonly (BranchActionId | { separator: string })[] = [
  "toggle-favorite",
  { separator: "favorite" },
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
  { separator: "sync" },
  "update",
  "push",
  { separator: "copy" },
  "copy-branch-name",
];

const tagMenu: readonly BranchActionId[] = [
  "toggle-favorite",
  "compare-current",
];

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
  if (id === "toggle-favorite" || id === "new-branch" || id === "copy-branch-name") {
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
      return "Delete";
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
