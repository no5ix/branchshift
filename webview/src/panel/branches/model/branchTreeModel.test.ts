import { describe, expect, it } from "vitest";
import type { BranchInfo, TagInfo } from "../../../shared/types/git";
import {
  buildBranchTreeSnapshot,
  normalizeBranchEntries,
  normalizeTagEntries,
} from "./branchTreeModel";
import {
  collectVisibleRefs,
  filterBranchTreeEntries,
} from "./branchTreeSelectors";
import type { BranchTreeSnapshot } from "./branchTreeTypes";

function branch(
  name: string,
  fullRef: string,
  overrides: Partial<BranchInfo> = {},
): BranchInfo {
  return {
    name,
    fullRef,
    isRemote: fullRef.startsWith("refs/remotes/"),
    isCurrent: false,
    isFavorite: false,
    ahead: 0,
    behind: 0,
    lastCommitHash: "tip",
    ...overrides,
  };
}

function tag(
  name: string,
  fullRef: string,
  overrides: Partial<TagInfo> = {},
): TagInfo {
  return {
    name,
    fullRef,
    hash: "tag-object",
    targetCommitHash: "tip",
    isFavorite: false,
    isAnnotated: false,
    ...overrides,
  };
}

function leafIds(snapshot: BranchTreeSnapshot): string[] {
  const ids: string[] = [];
  const visit = (nodes: BranchTreeSnapshot["roots"]) => {
    for (const node of nodes) {
      if (node.entry) ids.push(node.id);
      visit(node.children);
    }
  };
  visit(snapshot.roots);
  return ids;
}

describe("branch tree model", () => {
  it("builds stable repository-scoped grouped and flat snapshots without mutating inputs", () => {
    const localFeature = branch("feature/login", "refs/heads/feature/login", {
      isCurrent: true,
    });
    const remoteFeature = branch(
      "origin/feature/login",
      "refs/remotes/origin/feature/login",
    );
    const featureTag = tag("feature/login", "refs/tags/feature/login");
    const localFeatureBefore = { ...localFeature };
    const entries = [
      ...normalizeBranchEntries([localFeature, remoteFeature]),
      ...normalizeTagEntries([featureTag]),
    ];

    const grouped = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });
    const flat = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: false,
    });
    const groupedAgain = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    expect(leafIds(grouped)).toEqual(leafIds(groupedAgain));
    expect(new Set(leafIds(flat))).toEqual(new Set(leafIds(grouped)));
    expect(
      grouped.nodeIds.has("repo:repo-a:ref:refs/heads/feature/login"),
    ).toBe(true);
    expect(grouped.nodeIds.has("repo:repo-a:ref:refs/tags/feature/login")).toBe(
      true,
    );
    expect(grouped.nodeIds.has("repo:repo-a:dir:local:feature")).toBe(true);
    expect(grouped.nodeIds.has("repo:repo-a:dir:tag:feature")).toBe(true);
    expect(localFeature).toEqual(localFeatureBefore);
    expect(entries[0]?.branch).toBe(localFeature);
    expect(entries[2]?.tag).toBe(featureTag);
  });

  it("keeps local and remote branches with the same leaf name distinct", () => {
    const entries = normalizeBranchEntries([
      branch("feature", "refs/heads/feature"),
      branch("origin/feature", "refs/remotes/origin/feature"),
    ]);
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: false,
    });

    expect(leafIds(snapshot)).toEqual([
      "repo:repo-a:ref:refs/heads/feature",
      "repo:repo-a:ref:refs/remotes/origin/feature",
    ]);
  });

  it("assigns unique identities when a branch leaf and directory share a display name", () => {
    const entries = normalizeBranchEntries([
      branch("feature", "refs/heads/feature"),
      branch("feature/login", "refs/heads/feature/login"),
    ]);
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    expect(snapshot.nodeIds).toEqual(
      new Set([
        "repo:repo-a:dir:local:feature",
        "repo:repo-a:ref:refs/heads/feature",
        "repo:repo-a:ref:refs/heads/feature/login",
      ]),
    );
  });

  it("orders the current ref above favorites without changing source order", () => {
    const branches = [
      branch("zebra", "refs/heads/zebra"),
      branch("alpha", "refs/heads/alpha", { isCurrent: true }),
      branch("beta", "refs/heads/beta"),
    ];
    const entries = normalizeBranchEntries(
      branches,
      new Set(["refs/heads/zebra"]),
    );
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: false,
    });

    expect(snapshot.roots.map((node) => node.entry?.name)).toEqual([
      "alpha",
      "zebra",
      "beta",
    ]);
    expect(branches.map((item) => item.name)).toEqual([
      "zebra",
      "alpha",
      "beta",
    ]);
    expect(branches[0]?.isFavorite).toBe(false);
  });

  it("pins the default branch, then ungrouped branches, then folders", () => {
    const entries = normalizeBranchEntries([
      branch("feature/inline-hold", "refs/heads/feature/inline-hold"),
      branch("fix/toc-handle", "refs/heads/fix/toc-handle"),
      branch("feat/simplify-toc", "refs/heads/feat/simplify-toc"),
      branch("main-bak", "refs/heads/main-bak"),
      branch("main-bak2", "refs/heads/main-bak2"),
      branch("main-bak3", "refs/heads/main-bak3"),
      branch("main", "refs/heads/main", { isCurrent: true, isDefault: true }),
    ]);

    const grouped = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });
    expect(grouped.roots.map((node) => node.name)).toEqual([
      "main",
      "main-bak",
      "main-bak2",
      "main-bak3",
      "feat",
      "feature",
      "fix",
    ]);

    const flat = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: false,
    });
    expect(flat.roots.map((node) => node.name)).toEqual([
      "main",
      "feat/simplify-toc",
      "feature/inline-hold",
      "fix/toc-handle",
      "main-bak",
      "main-bak2",
      "main-bak3",
    ]);
  });

  it("pins the default branch above the checked-out branch and favorites", () => {
    const entries = normalizeBranchEntries(
      [
        branch("starred", "refs/heads/starred"),
        branch("work", "refs/heads/work", { isCurrent: true }),
        branch("main", "refs/heads/main", { isDefault: true }),
      ],
      new Set(["refs/heads/starred"]),
    );
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    expect(snapshot.roots.map((node) => node.name)).toEqual([
      "main",
      "work",
      "starred",
    ]);
  });

  it("keeps a favorite folder below the ungrouped branches", () => {
    const entries = normalizeBranchEntries(
      [
        branch("fix/starred", "refs/heads/fix/starred"),
        branch("loose", "refs/heads/loose"),
        branch("main", "refs/heads/main", { isCurrent: true, isDefault: true }),
      ],
      new Set(["refs/heads/fix/starred"]),
    );
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    expect(snapshot.roots.map((node) => node.name)).toEqual([
      "main",
      "loose",
      "fix",
    ]);
  });

  it("keeps folders before leaves below the root", () => {
    const entries = normalizeBranchEntries([
      branch("feature/x", "refs/heads/feature/x"),
      branch("feature/sub/y", "refs/heads/feature/sub/y"),
    ]);
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });
    const feature = snapshot.roots.find((node) => node.name === "feature");

    expect(feature?.children.map((node) => node.name)).toEqual(["sub", "x"]);
  });

  it("keeps same-path local, remote, and tag directories separate", () => {
    const entries = [
      ...normalizeBranchEntries([
        branch("feature/login", "refs/heads/feature/login"),
        branch("feature/logout", "refs/remotes/origin/feature/logout", {
          isRemote: true,
        }),
      ]),
      ...normalizeTagEntries([
        tag("feature/release", "refs/tags/feature/release"),
      ]),
    ];
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    expect(snapshot.directoryIds).toEqual(
      new Set([
        "repo:repo-a:dir:local:feature",
        "repo:repo-a:dir:remote:feature",
        "repo:repo-a:dir:tag:feature",
      ]),
    );
  });
});

describe("branch tree selectors", () => {
  it("filters matching refs without modifying entries", () => {
    const entries = [
      ...normalizeBranchEntries([
        branch("feature/login", "refs/heads/feature/login"),
        branch("fix/logout", "refs/heads/fix/logout"),
      ]),
      ...normalizeTagEntries([tag("LOGIN-v1", "refs/tags/LOGIN-v1")]),
    ];
    const before = entries.slice();

    const filtered = filterBranchTreeEntries(entries, "login");

    expect(filtered.map((entry) => entry.ref.fullRef)).toEqual([
      "refs/heads/feature/login",
      "refs/tags/LOGIN-v1",
    ]);
    expect(entries).toEqual(before);
  });

  it("omits refs below collapsed repository-scoped directory IDs", () => {
    const entries = [
      ...normalizeBranchEntries([
        branch("feature/login", "refs/heads/feature/login"),
        branch("main", "refs/heads/main"),
      ]),
      ...normalizeTagEntries([tag("feature/login", "refs/tags/feature/login")]),
    ];
    const snapshot = buildBranchTreeSnapshot(entries, {
      repoId: "repo-a",
      grouped: true,
    });

    const visible = collectVisibleRefs(
      snapshot.roots,
      new Set(["repo:repo-a:dir:local:feature"]),
    );

    // Root order is ungrouped refs first, so `main` precedes the tag folder.
    expect(visible.map((ref) => ref.fullRef)).toEqual([
      "refs/heads/main",
      "refs/tags/feature/login",
    ]);
  });
});
