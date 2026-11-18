import { describe, expect, it } from "vitest";
import type { BranchInfo, TagInfo } from "../../../shared/types/git";
import {
  getBranchActionAvailability,
  getBranchActionItems,
  resolveDeleteTargets,
} from "./branchActionState";
import type { BranchActionContext } from "./branchActionTypes";

const localBranch: BranchInfo = {
  name: "feature",
  fullRef: "refs/heads/feature",
  isRemote: false,
  isCurrent: false,
  isFavorite: false,
  upstream: "origin/feature",
  ahead: 1,
  behind: 2,
  lastCommitHash: "feature-tip",
};

function branchContext(branch: BranchInfo): BranchActionContext {
  return {
    repoId: "repo-a",
    ref: {
      type: branch.isRemote ? "remote" : "local",
      name: branch.name,
      fullRef: branch.fullRef,
    },
    branch,
    currentBranch: "main",
  };
}

function menuShape(context: BranchActionContext): string[] {
  return getBranchActionItems(context).map((item) =>
    item.kind === "separator" ? `separator:${item.id}` : item.id,
  );
}

describe("branch action availability", () => {
  it("hides actions that would operate on the checked-out branch itself", () => {
    const current = branchContext({
      ...localBranch,
      name: "main",
      fullRef: "refs/heads/main",
      isCurrent: true,
    });

    expect(getBranchActionAvailability("delete", current)).toEqual({
      visible: false,
      enabled: false,
    });
    expect(
      getBranchActionAvailability("delete-local-and-remote", current),
    ).toEqual({ visible: true, enabled: false });
    expect(menuShape(current)).toEqual([
      "update",
      "push",
      "force-push",
      "copy-branch-name",
      "separator:sync",
      "new-branch",
      "compare-current",
      "rename",
      "delete-local-and-remote",
      "separator:favorite",
      "toggle-favorite",
    ]);
    expect(
      getBranchActionItems(current).find(
        (item) => item.kind === "action" && item.id === "compare-current",
      ),
    ).toMatchObject({
      enabled: false,
      disabledReason: "Already checked out",
    });
  });

  it("keeps Update visible and explains why it is disabled without an upstream", () => {
    const noUpstream = branchContext({ ...localBranch, upstream: undefined });

    expect(getBranchActionAvailability("update", noUpstream)).toEqual({
      visible: true,
      enabled: false,
      disabledReason: "No upstream configured",
    });
  });

  it("uses the branch current marker to disable comparison", () => {
    const current = branchContext({
      ...localBranch,
      isCurrent: true,
    });

    expect(getBranchActionAvailability("compare-current", current)).toEqual({
      visible: true,
      enabled: false,
      disabledReason: "Already checked out",
    });
  });

  it("preserves the remote branch menu order while omitting local-only actions", () => {
    const remote = branchContext({
      ...localBranch,
      name: "origin/feature",
      fullRef: "refs/remotes/origin/feature",
      isRemote: true,
      upstream: undefined,
    });

    expect(getBranchActionAvailability("rename", remote).visible).toBe(false);
    expect(menuShape(remote)).toEqual([
      "copy-branch-name",
      "separator:sync",
      "checkout",
      "new-branch",
      "compare-current",
      "checkout-rebase",
      "separator:integrate",
      "rebase-current",
      "merge-current",
      "separator:manage",
      "delete",
      "delete-local-and-remote",
      "separator:favorite",
      "toggle-favorite",
    ]);
  });

  it("preserves the complete local branch menu order and labels", () => {
    const items = getBranchActionItems(branchContext(localBranch));

    expect(menuShape(branchContext(localBranch))).toEqual([
      "update",
      "push",
      "force-push",
      "copy-branch-name",
      "separator:sync",
      "checkout",
      "new-branch",
      "compare-current",
      "checkout-rebase",
      "separator:integrate",
      "rebase-current",
      "merge-current",
      "separator:manage",
      "rename",
      "delete",
      "delete-local-and-remote",
      "separator:favorite",
      "toggle-favorite",
    ]);
    expect(
      items.filter((item) => item.kind === "action").map((item) => item.label),
    ).toEqual([
      "Update",
      "Push",
      "Force Push...",
      "Copy Branch Name",
      "Checkout",
      "New Branch from 'feature'...",
      "Compare with Current",
      "Checkout and Rebase onto 'main'",
      "Rebase 'main' onto 'feature'",
      "Merge 'feature' into 'main'",
      "Rename...",
      "Delete",
      "Delete Local and Remote",
      "Mark as Favorite",
    ]);
  });

  it("labels Delete with the number of selected local branches", () => {
    const context = {
      ...branchContext(localBranch),
      selectedBranches: [
        localBranch,
        {
          ...localBranch,
          name: "feature/two",
          fullRef: "refs/heads/feature/two",
        },
      ],
    };

    expect(
      getBranchActionItems(context).find(
        (item) => item.kind === "action" && item.id === "delete",
      ),
    ).toMatchObject({
      label: "Delete 2 Branches",
      enabled: true,
    });
  });

  it("labels the combined delete action with the number of selected branches", () => {
    const context = {
      ...branchContext(localBranch),
      deleteSelectionCount: 11,
    };

    expect(
      getBranchActionItems(context).find(
        (item) =>
          item.kind === "action" && item.id === "delete-local-and-remote",
      ),
    ).toMatchObject({
      label: "Delete Local and Remote 11 Branches",
      enabled: true,
    });
  });

  it("resolves both sides of a local and remote branch pair without duplicates", () => {
    const remoteBranch: BranchInfo = {
      ...localBranch,
      name: "origin/feature",
      fullRef: "refs/remotes/origin/feature",
      isRemote: true,
      upstream: undefined,
    };

    expect(
      resolveDeleteTargets([localBranch], [localBranch, remoteBranch], "main"),
    ).toEqual([localBranch, remoteBranch]);
    expect(
      resolveDeleteTargets([remoteBranch], [localBranch, remoteBranch], "main"),
    ).toEqual([remoteBranch, localBranch]);
    expect(
      resolveDeleteTargets(
        [localBranch, remoteBranch],
        [localBranch, remoteBranch],
        "main",
      ),
    ).toEqual([localBranch, remoteBranch]);
  });

  it("never includes the checked-out local branch in combined deletion", () => {
    const current: BranchInfo = {
      ...localBranch,
      name: "main",
      fullRef: "refs/heads/main",
      isCurrent: true,
      upstream: "origin/main",
    };
    const remoteMain: BranchInfo = {
      ...current,
      name: "origin/main",
      fullRef: "refs/remotes/origin/main",
      isCurrent: false,
      isRemote: true,
      upstream: undefined,
    };

    expect(
      resolveDeleteTargets([current], [current, remoteMain], "main"),
    ).toEqual([remoteMain]);
  });

  it("offers only favorite and compare actions for a tag", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      fullRef: "refs/tags/v1.0.0",
      hash: "tag-object",
      targetCommitHash: "release-tip",
      isFavorite: true,
      isAnnotated: true,
    };
    const context: BranchActionContext = {
      repoId: "repo-a",
      ref: { type: "tag", name: tag.name, fullRef: tag.fullRef },
      tag,
      currentBranch: "main",
    };

    expect(menuShape(context)).toEqual([
      "compare-current",
      "separator:favorite",
      "toggle-favorite",
    ]);
    expect(
      getBranchActionItems(context).map((item) =>
        item.kind === "action" ? item.label : "separator",
      ),
    ).toEqual(["Compare with Current", "Unmark as Favorite"]);
  });
});
