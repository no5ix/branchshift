import type { GitRefIdentity } from "../../../shared/types/git";
import type { BranchOperations } from "../branchOperations";
import type {
  BranchActionContext,
  BranchActionError,
  BranchActionId,
} from "./branchActionTypes";

const BRANCH_NOT_FULLY_MERGED = "BRANCH_NOT_FULLY_MERGED";

export interface BranchActionUi {
  confirm(message: string, confirmLabel: string): Promise<boolean>;
  input(prompt: string, value: string): Promise<string | null>;
  openCreate(
    repoId: string,
    sourceRef: GitRefIdentity,
    startPoint: string,
    defaultName: string,
  ): void;
  openPush(repoId: string, sourceRef: GitRefIdentity, branchName: string): void;
  isCurrent(
    repoId: string,
    ref?: GitRefIdentity,
    currentBranch?: string,
  ): boolean;
  /**
   * Drop the Git Log's ref filter when the branch it was scoped to is removed
   * (deleted or renamed). Without this the panel keeps querying a ref that no
   * longer exists and the log stays in its unavailable-ref state.
   */
  clearRefFilterIfViewing(ref: GitRefIdentity): void;
  notifyError(title: string, error: BranchActionError): Promise<void>;
}

export interface BranchActionPorts {
  operations: BranchOperations;
  ui: BranchActionUi;
}

export async function runBranchAction(
  id: BranchActionId,
  context: BranchActionContext,
  ports: BranchActionPorts,
): Promise<void> {
  const { operations, ui } = ports;
  const { branch, ref, repoId } = context;
  if (!isActionCurrent(context, ui)) return;

  switch (id) {
    case "toggle-favorite": {
      const favorite = branch?.isFavorite ?? context.tag?.isFavorite;
      if (favorite === undefined) return;
      await runAndPresent(
        () => operations.setFavorite(repoId, ref, !favorite),
        "Could not update favorite",
        context,
        ui,
      );
      return;
    }
    case "checkout":
      if (!branch) return;
      await runAndPresent(
        () => operations.checkout(repoId, branch),
        "Checkout failed",
        context,
        ui,
      );
      return;
    case "new-branch": {
      if (!branch) return;
      const defaultName = branch.isRemote
        ? branch.name.substring(branch.name.indexOf("/") + 1)
        : branch.name;
      ui.openCreate(repoId, ref, branch.name, defaultName);
      return;
    }
    case "compare-current":
      await runAndPresent(
        () => operations.compare(repoId, ref),
        "Compare failed",
        context,
        ui,
      );
      return;
    case "checkout-rebase":
      if (!branch) return;
      await runAndPresent(
        () =>
          operations.checkoutAndRebase(
            repoId,
            branch.name,
            context.currentBranch,
          ),
        "Checkout and rebase failed",
        context,
        ui,
      );
      return;
    case "rebase-current":
      if (!branch) return;
      if (
        !(await confirmCurrent(
          `Rebase '${context.currentBranch}' onto '${branch.name}'?`,
          "Rebase",
          context,
          ui,
        ))
      )
        return;
      await runAndPresent(
        () => operations.rebase(repoId, branch.name),
        "Rebase failed",
        context,
        ui,
      );
      return;
    case "merge-current":
      if (!branch) return;
      if (
        !(await confirmCurrent(
          `Merge '${branch.name}' into '${context.currentBranch}'?`,
          "Merge",
          context,
          ui,
        ))
      )
        return;
      await runAndPresent(
        () => operations.merge(repoId, branch.name),
        "Merge failed",
        context,
        ui,
      );
      return;
    case "rename": {
      if (!branch) return;
      const value = await ui.input(
        `Rename branch '${branch.name}' to:`,
        branch.name,
      );
      if (!isActionCurrent(context, ui)) return;
      const newName = value?.trim();
      if (!newName || newName === branch.name) return;
      const renamed = await runAndPresent(
        () => operations.rename(repoId, branch.name, newName),
        "Rename failed",
        context,
        ui,
      );
      if (renamed) ui.clearRefFilterIfViewing(ref);
      return;
    }
    case "delete":
      if (!branch) return;
      if (
        !(await confirmCurrent(
          `Delete branch '${branch.name}'?`,
          "Delete",
          context,
          ui,
        ))
      )
        return;
      try {
        await operations.delete(repoId, branch, false);
        ui.clearRefFilterIfViewing(ref);
      } catch (error) {
        if (!isActionCurrent(context, ui)) return;
        const formatted = formatBranchActionError(error);
        if (formatted.code !== BRANCH_NOT_FULLY_MERGED) {
          await notifyBranchActionErrorIfCurrent(
            "Delete failed",
            formatted,
            context,
            ui,
          );
          return;
        }
        const force = await ui.confirm(
          `Branch '${branch.name}' is not fully merged. Force delete?`,
          "Force Delete",
        );
        if (!isActionCurrent(context, ui) || !force) return;
        const removed = await runAndPresent(
          () => operations.delete(repoId, branch, true),
          "Force delete failed",
          context,
          ui,
        );
        if (removed) ui.clearRefFilterIfViewing(ref);
      }
      return;
    case "update":
      if (!branch) return;
      await runAndPresent(
        () => operations.update(repoId, branch.name),
        "Update failed",
        context,
        ui,
      );
      return;
    case "push":
      if (!branch) return;
      ui.openPush(repoId, ref, branch.name);
  }
}

export function formatBranchActionError(error: unknown): BranchActionError {
  const value = error as {
    code?: unknown;
    message?: unknown;
    recovery?: unknown;
  };
  let message: string;
  if (typeof value?.message === "string") {
    message = value.message;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    console.error("Unexpected branch action error:", error);
    message = "An unexpected error occurred.";
  }
  return {
    code: typeof value?.code === "string" ? value.code : "UNKNOWN",
    message,
    ...(typeof value?.recovery === "string"
      ? { recovery: value.recovery }
      : {}),
  };
}

export async function submitCreateBranch(
  repoId: string,
  startPoint: string,
  input: { branchName: string; checkout: boolean; force: boolean },
  operations: BranchOperations,
): Promise<string | undefined> {
  try {
    await operations.create(repoId, {
      newBranchName: input.branchName,
      startPoint,
      checkout: input.checkout,
      force: input.force,
    });
    return undefined;
  } catch (error) {
    const formatted = formatBranchActionError(error);
    return formatted.recovery
      ? `${formatted.message}\n${formatted.recovery}`
      : formatted.message;
  }
}

export async function submitPush(
  repoId: string,
  branchName: string,
  force: boolean,
  operations: BranchOperations,
  ui: BranchActionUi,
): Promise<boolean> {
  try {
    await operations.push(repoId, branchName, force);
    return true;
  } catch (error) {
    const sourceRef: GitRefIdentity = {
      type: "local",
      name: branchName,
      fullRef: `refs/heads/${branchName}`,
    };
    if (ui.isCurrent(repoId, sourceRef)) {
      await ui.notifyError("Push failed", formatBranchActionError(error));
    }
    return false;
  }
}

async function confirmCurrent(
  message: string,
  label: string,
  context: BranchActionContext,
  ui: BranchActionUi,
): Promise<boolean> {
  const confirmed = await ui.confirm(message, label);
  return confirmed && isActionCurrent(context, ui);
}

async function runAndPresent(
  operation: () => Promise<void>,
  title: string,
  context: BranchActionContext,
  ui: BranchActionUi,
): Promise<boolean> {
  if (!isActionCurrent(context, ui)) return false;
  try {
    await operation();
    return true;
  } catch (error) {
    await notifyBranchActionErrorIfCurrent(
      title,
      formatBranchActionError(error),
      context,
      ui,
    );
    return false;
  }
}

export async function notifyBranchActionErrorIfCurrent(
  title: string,
  error: BranchActionError,
  context: {
    repoId: string;
    ref?: GitRefIdentity;
    currentBranch?: string;
  },
  ui: Pick<BranchActionUi, "isCurrent" | "notifyError">,
): Promise<void> {
  if (!ui.isCurrent(context.repoId, context.ref, context.currentBranch)) return;
  await ui.notifyError(title, error);
}

function isActionCurrent(
  context: BranchActionContext,
  ui: Pick<BranchActionUi, "isCurrent">,
): boolean {
  return ui.isCurrent(context.repoId, context.ref, context.currentBranch);
}
