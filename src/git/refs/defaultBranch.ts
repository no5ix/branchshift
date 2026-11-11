/**
 * Default-branch detection.
 *
 * The branch tree pins the repository's default branch at the top, which needs
 * a name Git does not expose as a single fact: `origin/HEAD` is the usual
 * answer, a bare or offline repository may only know `init.defaultBranch`, and
 * a fresh clone with no remote has nothing at all. Every layer is probed in
 * that order, and only a branch that actually exists locally is returned, so
 * the tree never pins a name the user cannot click.
 */

interface RefTextExecutor {
  text(args: string[]): Promise<string>;
}

const DEFAULT_BRANCH_CANDIDATES = ["main", "master"] as const;

function splitLines(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Resolve the branch the repository treats as its default, or `null` when it
 * cannot be determined. `localBranchNames` gates every candidate: a name that
 * has no local branch is not a usable pin.
 */
export async function resolveDefaultBranchName(
  executor: RefTextExecutor,
  localBranchNames: readonly string[],
): Promise<string | null> {
  const fromRemote = await defaultBranchFromRemoteHead(executor);
  if (fromRemote && localBranchNames.includes(fromRemote)) {
    return fromRemote;
  }

  const configured = await executor
    .text(["config", "--get", "init.defaultBranch"])
    .catch(() => "");
  const configuredName = configured.trim();
  if (configuredName && localBranchNames.includes(configuredName)) {
    return configuredName;
  }

  return (
    DEFAULT_BRANCH_CANDIDATES.find((candidate) =>
      localBranchNames.includes(candidate),
    ) ?? null
  );
}

/**
 * Read `<remote>/HEAD` (`git symbolic-ref refs/remotes/origin/HEAD`) for the
 * remote that owns the default branch. The remote is `origin` when present,
 * otherwise the first configured remote, so repositories that renamed or never
 * used `origin` are still covered.
 */
async function defaultBranchFromRemoteHead(
  executor: RefTextExecutor,
): Promise<string | null> {
  const remotes = splitLines(await executor.text(["remote"]).catch(() => ""));
  const remote = remotes.includes("origin") ? "origin" : remotes[0];
  if (!remote) {
    return null;
  }

  const symbolic = await executor
    .text(["symbolic-ref", `refs/remotes/${remote}/HEAD`])
    .catch(() => "");
  const value = symbolic.trim();
  if (!value) {
    return null;
  }

  // Accept the full ref and the `--short` forms, which differ by the `refs/`
  // prefix, so the probe does not depend on the flag's output shape.
  const prefixes = [`refs/remotes/${remote}/`, `remotes/${remote}/`];
  for (const prefix of prefixes) {
    if (value.startsWith(prefix) && value.length > prefix.length) {
      return value.slice(prefix.length);
    }
  }
  if (value.startsWith("refs/heads/") && value.length > "refs/heads/".length) {
    return value.slice("refs/heads/".length);
  }
  return null;
}
