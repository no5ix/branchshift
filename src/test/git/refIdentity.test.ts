import * as assert from "node:assert";
import { refIdentityFromFullRef } from "../../git/refs/refIdentity";

describe("refIdentityFromFullRef", () => {
  it("maps local, remote, and tag full refs to their structured identity", () => {
    assert.deepStrictEqual(
      refIdentityFromFullRef("refs/heads/fix/selection-toolbar"),
      {
        type: "local",
        name: "fix/selection-toolbar",
        fullRef: "refs/heads/fix/selection-toolbar",
      },
    );
    assert.deepStrictEqual(refIdentityFromFullRef("refs/remotes/origin/main"), {
      type: "remote",
      name: "origin/main",
      fullRef: "refs/remotes/origin/main",
    });
    assert.deepStrictEqual(refIdentityFromFullRef("refs/tags/v1.0.0"), {
      type: "tag",
      name: "v1.0.0",
      fullRef: "refs/tags/v1.0.0",
    });
  });

  it("treats a full object id as a detached identity", () => {
    const sha = "a".repeat(40);
    assert.deepStrictEqual(refIdentityFromFullRef(sha), {
      type: "detached",
      name: sha,
      fullRef: sha,
    });
  });

  it("rejects every parameter that must not reach Git", () => {
    for (const value of [
      undefined,
      "",
      "HEAD",
      "main",
      "refs/heads/",
      "refs/notes/commits",
      "--all",
    ]) {
      assert.strictEqual(refIdentityFromFullRef(value), null);
    }
  });
});
