import * as assert from "node:assert";
import * as vscode from "vscode";
import { CommitViewProvider } from "../../views/commitViewProvider";

type FakeWebviewView = vscode.WebviewView & {
  triggerVisibilityChange: () => void;
  triggerDispose: () => void;
};

function createFakeWebviewView(initialVisible: boolean): FakeWebviewView {
  let visibilityListener: (() => void) | undefined;
  let disposeListener: (() => void) | undefined;

  const webview = {
    cspSource: "vscode-webview:",
    asWebviewUri: (uri: vscode.Uri) => uri,
    html: "",
  } as unknown as vscode.Webview;

  const view = {
    webview,
    visible: initialVisible,
    onDidDispose: (listener: () => void) => {
      disposeListener = listener;
      return { dispose() {} };
    },
    onDidChangeVisibility: (listener: () => void) => {
      visibilityListener = listener;
      return { dispose() {} };
    },
    triggerVisibilityChange: () => visibilityListener?.(),
    triggerDispose: () => disposeListener?.(),
  } as unknown as FakeWebviewView;

  return view;
}

describe("CommitViewProvider panel ownership", () => {
  it("keeps the Commit container resolvable while activation is still running", async () => {
    let markReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let registered = 0;
    const provider = new CommitViewProvider(
      vscode.Uri.file("/extension"),
      {
        registerWebview: () => {
          registered += 1;
          return { dispose() {} };
        },
        broadcastEvent: () => {},
      } as never,
      { getActive: () => null } as never,
      ready,
    );
    const view = createFakeWebviewView(true);

    provider.resolveWebviewView(view, {} as never, {} as never);
    assert.match((view.webview as vscode.Webview).html, /Loading BranchShift/);
    assert.strictEqual(registered, 0);

    markReady();
    await Promise.resolve();
    assert.strictEqual(registered, 1);
    assert.doesNotMatch((view.webview as vscode.Webview).html, /Loading BranchShift/);
  });

  it("does not register a disposed view after activation becomes ready", async () => {
    let markReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let registered = 0;
    const provider = new CommitViewProvider(
      vscode.Uri.file("/extension"),
      {
        registerWebview: () => {
          registered += 1;
          return { dispose() {} };
        },
        broadcastEvent: () => {},
      } as never,
      { getActive: () => null } as never,
      ready,
    );
    const view = createFakeWebviewView(false);

    provider.resolveWebviewView(view, {} as never, {} as never);
    view.triggerDispose();
    markReady();
    await Promise.resolve();

    assert.strictEqual(registered, 0);
  });

  it("does not change the bottom panel when the Commit view is hidden", () => {
    const executedCommands: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    const commandApi = vscode.commands as unknown as {
      executeCommand: typeof originalExecuteCommand;
    };
    commandApi.executeCommand = async <T = unknown>(command: string) => {
      executedCommands.push(command);
      return undefined as T;
    };

    try {
      const provider = new CommitViewProvider(
        vscode.Uri.file("/extension"),
        {
          registerWebview: () => ({ dispose() {} }),
          broadcastEvent: () => {},
        } as never,
        {
          getActive: () => null,
        } as never,
      );
      const view = createFakeWebviewView(false);

      provider.resolveWebviewView(view, {} as never, {} as never);
      view.triggerVisibilityChange();

      assert.deepStrictEqual(executedCommands, []);
    } finally {
      commandApi.executeCommand = originalExecuteCommand;
    }
  });

  it("does not focus the bottom panel when the Commit view becomes visible", async () => {
    const executedCommands: string[] = [];
    const originalExecuteCommand = vscode.commands.executeCommand;
    const commandApi = vscode.commands as unknown as {
      executeCommand: typeof originalExecuteCommand;
    };
    commandApi.executeCommand = async <T = unknown>(command: string) => {
      executedCommands.push(command);
      return undefined as T;
    };

    try {
      const provider = new CommitViewProvider(
        vscode.Uri.file("/extension"),
        {
          registerWebview: () => ({ dispose() {} }),
          broadcastEvent: () => {},
        } as never,
        {
          getActive: () => null,
        } as never,
      );
      const view = createFakeWebviewView(false);

      provider.resolveWebviewView(view, {} as never, {} as never);
      (view as unknown as { visible: boolean }).visible = true;
      view.triggerVisibilityChange();
      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.deepStrictEqual(executedCommands, []);
    } finally {
      commandApi.executeCommand = originalExecuteCommand;
    }
  });
});
