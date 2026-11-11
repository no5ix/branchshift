import * as assert from "node:assert";
import { resolveDefaultBranchName } from "../../git/refs/defaultBranch";

function executor(responses: Record<string, string>) {
  return {
    text: async (args: string[]) => {
      const key = args.join(" ");
      if (key in responses) {
        return responses[key];
      }
      throw new Error(`unexpected git ${key}`);
    },
  };
}

describe("resolveDefaultBranchName", () => {
  it("prefers the remote symbolic HEAD", async () => {
    const name = await resolveDefaultBranchName(
      executor({
        remote: "origin\n",
        "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main\n",
      }),
      ["main", "feature"],
    );

    assert.strictEqual(name, "main");
  });

  it("uses the first configured remote when origin is absent", async () => {
    const name = await resolveDefaultBranchName(
      executor({
        remote: "upstream\n",
        "symbolic-ref refs/remotes/upstream/HEAD":
          "refs/remotes/upstream/develop\n",
      }),
      ["develop", "feature"],
    );

    assert.strictEqual(name, "develop");
  });

  it("accepts the short symbolic-ref form", async () => {
    const name = await resolveDefaultBranchName(
      executor({
        remote: "origin",
        "symbolic-ref refs/remotes/origin/HEAD": "remotes/origin/main",
      }),
      ["main"],
    );

    assert.strictEqual(name, "main");
  });

  it("falls back to init.defaultBranch when the remote head has no local branch", async () => {
    const name = await resolveDefaultBranchName(
      executor({
        remote: "origin",
        "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main",
        "config --get init.defaultBranch": "trunk\n",
      }),
      ["trunk", "feature"],
    );

    assert.strictEqual(name, "trunk");
  });

  it("falls back to main, then master, when nothing is configured", async () => {
    const bare = executor({ remote: "" });

    assert.strictEqual(
      await resolveDefaultBranchName(bare, ["feature", "main", "master"]),
      "main",
    );
    assert.strictEqual(
      await resolveDefaultBranchName(bare, ["feature", "master"]),
      "master",
    );
  });

  it("returns null when no candidate has a local branch", async () => {
    const name = await resolveDefaultBranchName(
      executor({
        remote: "origin",
        "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main",
      }),
      ["feature-only"],
    );

    assert.strictEqual(name, null);
  });

  it("survives every probe failing", async () => {
    const name = await resolveDefaultBranchName(executor({}), ["feature"]);

    assert.strictEqual(name, null);
  });
});
