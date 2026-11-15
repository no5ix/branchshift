import type {
  BranchInfo,
  GitRefIdentity,
  TagInfo,
} from "../../../shared/types/git";

export interface BranchActionContext {
  repoId: string;
  ref: GitRefIdentity;
  branch?: BranchInfo;
  selectedBranches?: BranchInfo[];
  /** Local and remote refs to remove together, including matched upstream and
   * downstream refs.
   */
  deleteTargets?: BranchInfo[];
  /** Number of selected branch rows represented by a combined delete action. */
  deleteSelectionCount?: number;
  tag?: TagInfo;
  currentBranch: string;
}

export type BranchActionId =
  | "toggle-favorite"
  | "checkout"
  | "new-branch"
  | "compare-current"
  | "checkout-rebase"
  | "rebase-current"
  | "merge-current"
  | "rename"
  | "delete"
  | "delete-local-and-remote"
  | "update"
  | "push"
  | "copy-branch-name";

export type BranchActionMenuItem =
  | { kind: "separator"; id: string }
  | {
      kind: "action";
      id: BranchActionId;
      label: string;
      enabled: boolean;
      disabledReason?: string;
    };

export interface BranchActionAvailability {
  visible: boolean;
  enabled: boolean;
  disabledReason?: string;
}

export interface BranchActionError {
  code: string;
  message: string;
  recovery?: string;
}
