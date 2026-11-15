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
      "%(upstream:remotename)",
      "%(upstream:remoteref)",
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

    const remoteNames = new Set(
      remoteOutput
        .trim()
        .split("\n")
        .map((line) => line.split(FIELD_SEP)[0]?.trim() ?? "")
        .filter(Boolean),
    );
    const localBranches = await parseBranchOutput(
      localOutput,
      false,
      worktreeCheckouts,
      this.executor,
      remoteNames,
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
      ...(await parseBranchOutput(
        remoteOutput,
        true,
        worktreeCheckouts,
        this.executor,
      )),
    ];
  }
}

async function resolveAheadBehind(
  executor: { text(args: string[]): Promise<string> },
  localRef: string,
  upstreamRef: string,
  fallback: { ahead: number; behind: number },
): Promise<{ ahead: number; behind: number }> {
  try {
    const [local, upstream] = await Promise.all([
      executor.text(["rev-parse", "--verify", localRef]),
      executor.text(["rev-parse", "--verify", upstreamRef]),
    ]);
    const [ahead, behind] = await Promise.all([
      executor.text([
        "rev-list",
        "--count",
        `${upstream.trim()}..${local.trim()}`,
      ]),
      executor.text([
        "rev-list",
        "--count",
        `${local.trim()}..${upstream.trim()}`,
      ]),
    ]);
    return {
      ahead: Number.parseInt(ahead.trim(), 10) || 0,
      behind: Number.parseInt(behind.trim(), 10) || 0,
    };
  } catch {
    return fallback;
  }
}

async function parseBranchOutput(
  output: string,
  isRemote: boolean,
  worktreeCheckouts: ReadonlyMap<string, string>,
  executor: GitExecutor,
  availableRemoteNames: ReadonlySet<string> = new Set(),
): Promise<BranchInfo[]> {
  const branches: BranchInfo[] = [];
  for (const line of output.trim().split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(FIELD_SEP);
    const name = fields[0]?.trim() ?? "";
    const fullRef =
      fields[1]?.trim() ?? `refs/${isRemote ? "remotes" : "heads"}/${name}`;
    const ref = parseGitRef(fullRef, name);
    if (
      ref.kind === "remote" &&
      ref.id.startsWith("refs/remotes/") &&
      ref.id.endsWith("/HEAD") &&
      ref.id.slice("refs/remotes/".length).split("/").length === 2
    ) {
      continue;
    }

    let counts = isRemote
      ? { ahead: 0, behind: 0 }
      : parseTrack(fields[4]?.trim() ?? "");
    let upstream = !isRemote ? fields[3]?.trim() || undefined : undefined;

    if (!isRemote) {
      const configured = await resolveConfiguredUpstream(executor, name);
      const inferred = configured
        ? undefined
        : inferMatchingRemoteBranch(name, availableRemoteNames);
      const trackingRef = configured?.trackingRef ?? inferred?.trackingRef;
      upstream = configured?.displayName ?? inferred?.displayName ?? upstream;
      if (trackingRef) {
        counts = await resolveAheadBehind(executor, fullRef, trackingRef, counts);
      }
    }

    branches.push({
      name: ref.shortName,
      fullRef: ref.id,
      isRemote: ref.kind === "remote",
      isCurrent: !isRemote && fields[2]?.trim() === "*",
      upstream,
      checkedOutWorktreePath: !isRemote
        ? worktreeCheckouts.get(ref.id)
        : undefined,
      ahead: counts.ahead,
      behind: counts.behind,
      lastCommitHash: fields[5]?.trim() ?? "",
    });
  }
  return branches;
}

async function resolveConfiguredUpstream(
  executor: GitExecutor,
  branchName: string,
): Promise<{ displayName: string; trackingRef: string } | null> {
  const [remoteResult, mergeResult] = await Promise.all([
    executor
      .text(["config", "--get", `branch.${branchName}.remote`])
      .catch(() => ""),
    executor
      .text(["config", "--get", `branch.${branchName}.merge`])
      .catch(() => ""),
  ]);
  const remote = remoteResult.trim();
  const mergeRef = mergeResult.trim();
  if (!remote || !mergeRef || remote === ".") return null;

  const branch = mergeRef.startsWith("refs/heads/")
    ? mergeRef.slice("refs/heads/".length)
    : mergeRef;
  return {
    displayName: `${remote}/${branch}`,
    trackingRef: `refs/remotes/${remote}/${branch}`,
  };
}

function inferMatchingRemoteBranch(
  branchName: string,
  remoteNames: ReadonlySet<string>,
): { displayName: string; trackingRef: string } | null {
  const candidates = [...remoteNames].filter(
    (name) => name.slice(name.indexOf("/") + 1) === branchName,
  );
  const selected = candidates.includes(`origin/${branchName}`)
    ? `origin/${branchName}`
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if (!selected) return null;
  return {
    displayName: selected,
    trackingRef: `refs/remotes/${selected}`,
  };
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
