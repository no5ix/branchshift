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
  it("marks a rebased branch for a lease-protected push", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "branchshift-rebase-push-"),
    );
    const remote = path.join(root, "remote.git");
    const repo = path.join(root, "repo");
    try {
      await fs.mkdir(repo);
      await git(root, "init", "--bare", remote);
      await git(repo, "init", "-b", "main");
      await git(repo, "config", "user.name", "BranchShift Test");
      await git(repo, "config", "user.email", "branchshift@example.com");
      await fs.writeFile(path.join(repo, "README.md"), "initial\n");
      await git(repo, "add", "README.md");
      await git(repo, "commit", "-m", "initial");
      await git(repo, "remote", "add", "origin", remote);
      await git(repo, "push", "-u", "origin", "main");

      await git(repo, "checkout", "-b", "topic");
      await fs.writeFile(path.join(repo, "topic.txt"), "topic\n");
      await git(repo, "add", "topic.txt");
      await git(repo, "commit", "-m", "topic");
      await git(repo, "push", "-u", "origin", "topic");

      await git(repo, "checkout", "main");
      await fs.writeFile(path.join(repo, "main.txt"), "main change\n");
      await git(repo, "add", "main.txt");
      await git(repo, "commit", "-m", "main change");
      await git(repo, "push", "origin", "main");

      await git(repo, "checkout", "topic");
      const service = serviceFor(repo);
      const result = await service.rebaseBranchAndDetectRewrite("main", "topic");
      assert.strictEqual(result.rewrittenUpstream, true);
      await service.markBranchForLeasePush("topic");
      assert.strictEqual(await service.consumeLeasePushMarker("topic"), true);
      assert.strictEqual(await service.consumeLeasePushMarker("topic"), false);
      await service.push("topic", true, "origin", "topic");
      assert.strictEqual(
        await git(repo, "rev-parse", "topic"),
        await git(repo, "ls-remote", "origin", "refs/heads/topic").then((v) => v.split("\\t")[0]),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

});
