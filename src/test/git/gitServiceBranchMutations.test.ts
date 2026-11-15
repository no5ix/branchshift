import * as assert from "node:assert";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { BranchShiftError, BranchShiftErrorCode } from "../../git/errors";
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

describe("GitService branch mutations", () => {
  it("deletes a remote branch and prunes its local remote-tracking ref", async () => {
    const repo = await fs.mkdtemp(
      path.join(os.tmpdir(), "branchshift-delete-remote-"),
    );
    const remote = path.join(repo, "remote.git");
    const worktree = path.join(repo, "worktree");
    try {
      await fs.mkdir(worktree);
      await git(repo, "init", "--bare", remote);
      await git(worktree, "init", "-b", "main");
      await git(worktree, "config", "user.name", "BranchShift Test");
      await git(worktree, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(worktree, "README.md"), "initial\\n");
      await git(worktree, "add", "README.md");
      await git(worktree, "commit", "-m", "initial");
      await git(worktree, "remote", "add", "origin", remote);
      await git(worktree, "push", "-u", "origin", "main");
      await git(worktree, "checkout", "-b", "topic");
      await fs.writeFile(path.join(worktree, "topic.txt"), "topic\\n");
      await git(worktree, "add", "topic.txt");
      await git(worktree, "commit", "-m", "topic");
      await git(worktree, "push", "-u", "origin", "topic");
      await git(worktree, "checkout", "main");

      assert.strictEqual(
        await git(worktree, "rev-parse", "--verify", "refs/remotes/origin/topic"),
        await git(worktree, "rev-parse", "--verify", "refs/heads/topic"),
      );

      await serviceFor(worktree).deleteRemoteBranch("origin/topic");

      assert.strictEqual(
        await git(worktree, "ls-remote", "--heads", "origin", "refs/heads/topic"),
        "",
      );
      await assert.rejects(
        git(worktree, "rev-parse", "--verify", "refs/remotes/origin/topic"),
      );
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("reports an unmerged branch as a typed safe-delete rejection", async () => {
    const repo = await fs.mkdtemp(
      path.join(os.tmpdir(), "branchshift-delete-"),
    );
    try {
      await git(repo, "init", "-b", "main");
      await git(repo, "config", "user.name", "BranchShift Test");
      await git(repo, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(repo, "README.md"), "initial\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "initial");
      await git(repo, "checkout", "-b", "topic");
      await fs.writeFile(path.join(repo, "topic.txt"), "topic\n");
      await git(repo, "add", "topic.txt");
      await git(repo, "commit", "-m", "topic");
      const topicHash = await git(repo, "rev-parse", "HEAD");
      await git(repo, "checkout", "main");

      await assert.rejects(
        serviceFor(repo).deleteBranch("topic", false),
        (error: unknown) =>
          error instanceof BranchShiftError &&
          error.code === BranchShiftErrorCode.BRANCH_NOT_FULLY_MERGED,
      );
      assert.strictEqual(
        await git(repo, "rev-parse", "--verify", "topic"),
        topicHash,
      );

      await serviceFor(repo).deleteBranch("topic", true);
      await assert.rejects(git(repo, "rev-parse", "--verify", "topic"));
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });
});
