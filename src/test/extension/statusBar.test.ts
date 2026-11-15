import * as assert from "node:assert";
import * as vscode from "vscode";
import { registerBranchShiftStatusBarItem } from "../../extension";

describe("BranchShift status bar registration", () => {
  it("shows and subscribes the item synchronously with the expected action", () => {
    const fakeItem = {
      text: "",
      tooltip: "",
      command: "",
      showCount: 0,
      show() {
        fakeItem.showCount += 1;
      },
      dispose() {},
    };
    const item = fakeItem as unknown as vscode.StatusBarItem;
    const subscriptions: vscode.Disposable[] = [];
    let receivedAlignment: vscode.StatusBarAlignment | undefined;
    let receivedPriority: number | undefined;

    registerBranchShiftStatusBarItem(subscriptions, {
      createStatusBarItem(alignment, priority) {
        receivedAlignment = alignment as vscode.StatusBarAlignment;
        receivedPriority = priority;
        return item;
      },
    });

    assert.strictEqual(receivedAlignment, vscode.StatusBarAlignment.Left);
    assert.strictEqual(receivedPriority, 100);
    assert.strictEqual(item.text, "$(git-branch) BranchShift");
    assert.strictEqual(item.tooltip, "Open BranchShift Git Log");
    assert.strictEqual(item.command, "branchshift.gitLog.focus");
    assert.strictEqual(fakeItem.showCount, 1);
    assert.deepStrictEqual(subscriptions, [item]);
  });
});
