import type {
  BranchInfo,
  GitRefIdentity,
  TagInfo,
} from "../../../shared/types/git";

export type BranchTreeMode = "grouped" | "flat";
export type BranchTreeScope = "local" | "remote" | "tag";

export interface BranchTreeEntry {
  ref: GitRefIdentity;
  scope: BranchTreeScope;
  name: string;
  isCurrent: boolean;
  /** Repository default branch: pinned above every other ref in the tree. */
  isDefault: boolean;
  isFavorite: boolean;
  branch?: BranchInfo;
  tag?: TagInfo;
}

export interface BranchTreeNode {
  id: string;
  name: string;
  children: readonly BranchTreeNode[];
  entry?: BranchTreeEntry;
  isLeaf: boolean;
}

export interface BranchTreeSnapshot {
  roots: readonly BranchTreeNode[];
  nodeIds: ReadonlySet<string>;
  directoryIds: ReadonlySet<string>;
}
