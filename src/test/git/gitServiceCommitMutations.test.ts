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

async function setupRepo(): Promise<{
  repo: string;
  service: GitService;
  base: string;
  first: string;
  second: string;
}> {
  const repo = await fs.mkdtemp(
    path.join(os.tmpdir(), "branchshift-commit-mutations-"),
  );
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "BranchShift Test");
  await git(repo, "config", "user.email", "branchshift@example.com");
  await fs.writeFile(path.join(repo, "history.txt"), "base\n");
  await git(repo, "add", "history.txt");
  await git(repo, "commit", "-m", "base commit");
  const base = await git(repo, "rev-parse", "HEAD");
  await fs.writeFile(path.join(repo, "history.txt"), "base\nfirst\n");
  await git(repo, "add", "history.txt");
  await git(repo, "commit", "-m", "first feature commit");
  const first = await git(repo, "rev-parse", "HEAD");
  await fs.writeFile(
    path.join(repo, "history.txt"),
    "base\nfirst\nsecond\n",
  );
  await git(repo, "add", "history.txt");
  await git(repo, "commit", "-m", "second feature commit");
  const second = await git(repo, "rev-parse", "HEAD");
  const service = new GitService({
    workTreeRoot: repo,
    gitDir: path.join(repo, ".git"),
    commonDir: path.join(repo, ".git"),
  });
  return { repo, service, base, first, second };
}

describe("GitService multi-commit operations", () => {
  it("cherry-picks multiple commits oldest-first", async () => {
    const fixture = await setupRepo();
    try {
      await git(fixture.repo, "checkout", "-b", "destination", fixture.base);
      await fixture.service.cherryPickMany([fixture.first, fixture.second]);
      assert.strictEqual(
        await git(fixture.repo, "log", "-2", "--format=%s"),
        "second feature commit\nfirst feature commit",
      );
    } finally {
      await fs.rm(fixture.repo, { recursive: true, force: true });
    }
  });

  it("squashes consecutive selected commits at HEAD into one commit", async () => {
    const fixture = await setupRepo();
    try {
      await fixture.service.squashCommits(
        [fixture.first, fixture.second],
        "combined feature",
      );
      assert.strictEqual(
        await git(fixture.repo, "rev-parse", "HEAD^"),
        fixture.base,
      );
      assert.strictEqual(
        await git(fixture.repo, "log", "-1", "--format=%s"),
        "combined feature",
      );
      assert.strictEqual(await git(fixture.repo, "status", "--porcelain"), "");
    } finally {
      await fs.rm(fixture.repo, { recursive: true, force: true });
    }
  });

  it("rejects squash when selected commits do not end at HEAD", async () => {
    const fixture = await setupRepo();
    try {
      await assert.rejects(
        fixture.service.squashCommits(
          [fixture.base, fixture.first],
          "invalid",
        ),
        /consecutive commits that end at the current HEAD/,
      );
      assert.strictEqual(
        await git(fixture.repo, "rev-parse", "HEAD"),
        fixture.second,
      );
    } finally {
      await fs.rm(fixture.repo, { recursive: true, force: true });
    }
  });
});
