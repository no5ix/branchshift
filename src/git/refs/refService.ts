import type { GitExecutor } from "../core/gitExecutor";
import type { BranchInfo } from "../types";
import { resolveDefaultBranchName } from "./defaultBranch";
import { parseGitRef } from "./refParser";

const FIELD_SEP = "\x00";
const REF_FMT_FIELD_SEP = "%00";

export class RefService {
  constructor(private readonly executor: GitExecutor) {}

  async getBranches(): Promise<BranchInfo[]> {
    const branchFormat = [
      "%(refname:short)",
      "%(refname)",
      "%(HEAD)",
      "%(upstream:short)",
      "%(upstream:track,nobracket)",
      "%(objectname)",
    ].join(REF_FMT_FIELD_SEP);
    const worktreeCheckouts = parseWorktreeCheckouts(
      await this.executor
        .text(["worktree", "list", "--porcelain"])
        .catch(() => ""),
    );
    const localOutput = await this.executor.text([
      "branch",
      `--format=${branchFormat}`,
    ]);
    const remoteOutput = await this.executor
      .text(["branch", "-r", `--format=${branchFormat}`])
      .catch(() => "");

    const localBranches = parseBranchOutput(
      localOutput,
      false,
      worktreeCheckouts,
    );
    // Pin target for the branch tree: resolved after the names are known, and
    // only a name with a local branch is ever marked.
    const defaultName = await resolveDefaultBranchName(
      this.executor,
      localBranches.map((branch) => branch.name),
    );

    return [
      ...localBranches.map((branch) => ({
        ...branch,
        isDefault: branch.name === defaultName,
      })),
      ...parseBranchOutput(remoteOutput, true, worktreeCheckouts),
    ];
  }
}

function parseBranchOutput(
  output: string,
  isRemote: boolean,
  worktreeCheckouts: ReadonlyMap<string, string>,
): BranchInfo[] {
  const branches: BranchInfo[] = [];
  for (const line of output.trim().split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(FIELD_SEP);
    const name = fields[0]?.trim() ?? "";
    const fullRef =
      fields[1]?.trim() ?? `refs/${isRemote ? "remotes" : "heads"}/${name}`;
    const ref = parseGitRef(fullRef, name);
    if (ref.kind === "remote" && /^refs\/remotes\/[^/]+\/HEAD$/.test(ref.id)) {
      continue;
    }
    const track = fields[4]?.trim() ?? "";
    const { ahead, behind } = isRemote
      ? { ahead: 0, behind: 0 }
      : parseTrack(track);
    branches.push({
      name: ref.shortName,
      fullRef: ref.id,
      isRemote: ref.kind === "remote",
      isCurrent: !isRemote && fields[2]?.trim() === "*",
      upstream: !isRemote ? fields[3]?.trim() || undefined : undefined,
      checkedOutWorktreePath: !isRemote
        ? worktreeCheckouts.get(ref.id)
        : undefined,
      ahead,
      behind,
      lastCommitHash: fields[5]?.trim() ?? "",
    });
  }
  return branches;
}

function parseTrack(track: string): { ahead: number; behind: number } {
  const ahead = Number(track.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(track.match(/behind (\d+)/)?.[1] ?? 0);
  return { ahead, behind };
}

function parseWorktreeCheckouts(output: string): Map<string, string> {
  const result = new Map<string, string>();
  let worktreePath: string | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      worktreePath = line.slice("worktree ".length);
    } else if (line.startsWith("branch ") && worktreePath) {
      result.set(line.slice("branch ".length), worktreePath);
    } else if (!line.trim()) {
      worktreePath = undefined;
    }
  }
  return result;
}
