import * as assert from "node:assert";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { GitService } from "../../git/gitService";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

function serviceFor(repo: string): GitService {
  return new GitService({
    workTreeRoot: repo,
    gitDir: path.join(repo, ".git"),
    commonDir: path.join(repo, ".git"),
  });
}

describe("RefService branch queries", () => {
  it("excludes every remote symbolic default ref while retaining branches from two remotes", async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "branchshift-refs-"));
    const repo = path.join(base, "repo");
    const first = path.join(base, "first.git");
    const second = path.join(base, "second.git");
    try {
      await git(base, "init", "--bare", first);
      await git(base, "init", "--bare", second);
      await git(base, "init", "-b", "main", repo);
      await git(repo, "config", "user.name", "BranchShift Test");
      await git(repo, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(repo, "README.md"), "initial\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "initial");
      await git(repo, "remote", "add", "first", first);
      await git(repo, "remote", "add", "second", second);
      await git(repo, "push", "first", "main");
      await git(repo, "push", "second", "main");
      await git(
        base,
        "--git-dir",
        first,
        "symbolic-ref",
        "HEAD",
        "refs/heads/main",
      );
      await git(
        base,
        "--git-dir",
        second,
        "symbolic-ref",
        "HEAD",
        "refs/heads/main",
      );
      await git(repo, "fetch", "--all");

      const branches = await serviceFor(repo).getBranches();

      assert.deepStrictEqual(
        branches
          .filter((branch) => branch.isRemote)
          .map((branch) => branch.fullRef)
          .sort(),
        ["refs/remotes/first/main", "refs/remotes/second/main"],
      );
      assert.ok(
        branches.every(
          (branch) => !/^refs\/remotes\/[^/]+\/HEAD$/.test(branch.fullRef),
        ),
      );
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it("marks the default branch from the remote symbolic HEAD", async () => {
    const base = await fs.mkdtemp(
      path.join(os.tmpdir(), "branchshift-default-"),
    );
    const repo = path.join(base, "repo");
    const remote = path.join(base, "remote.git");
    try {
      await git(base, "init", "--bare", remote);
      await git(base, "init", "-b", "main", repo);
      await git(repo, "config", "user.name", "BranchShift Test");
      await git(repo, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(repo, "README.md"), "initial\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "initial");
      await git(repo, "remote", "add", "origin", remote);
      await git(repo, "push", "-u", "origin", "main");
      await git(repo, "remote", "set-head", "origin", "-a");
      await git(repo, "checkout", "-b", "feature");

      const local = (await serviceFor(repo).getBranches()).filter(
        (branch) => !branch.isRemote,
      );

      assert.deepStrictEqual(
        local.filter((branch) => branch.isDefault).map((branch) => branch.name),
        ["main"],
      );
      assert.strictEqual(
        local.find((branch) => branch.name === "feature")?.isDefault,
        false,
      );
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it("marks main in a repository without any remote", async () => {
    const base = await fs.mkdtemp(
      path.join(os.tmpdir(), "branchshift-default-bare-"),
    );
    const repo = path.join(base, "repo");
    try {
      await git(base, "init", "-b", "main", repo);
      await git(repo, "config", "user.name", "BranchShift Test");
      await git(repo, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(repo, "README.md"), "initial\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "initial");
      await git(repo, "branch", "feature");

      const branches = await serviceFor(repo).getBranches();

      assert.deepStrictEqual(
        branches
          .filter((branch) => branch.isDefault)
          .map((branch) => branch.name),
        ["main"],
      );
      assert.ok(
        branches.every((branch) => !branch.isRemote || !branch.isDefault),
      );
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });
});
