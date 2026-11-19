import * as vscode from "vscode";
import type { RepoRegistry } from "../git/repoRegistry";
import type { MessageRouter } from "../messages/messageRouter";
import { getWebviewHtml } from "./html";

export class CommitViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "branchshift.commitPanel";

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly messageRouter: MessageRouter,
    private readonly repoRegistry: RepoRegistry,
    private readonly ready: Promise<void> = Promise.resolve(),
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };

    // Resolve the Activity Bar container immediately, even while activation
    // is still discovering repositories and registering message handlers.
    webview.html =
      "<!DOCTYPE html><html><body><p>Loading BranchShift…</p></body></html>";

    let disposed = false;
    let routerDisposable: vscode.Disposable | undefined;
    webviewView.onDidDispose(() => {
      disposed = true;
      routerDisposable?.dispose();
    });

    void this.ready.then(() => {
      if (disposed) return;

      webview.html = getWebviewHtml(webview, this.extensionUri, "commit");
      routerDisposable = this.messageRouter.registerWebview(webview);

      // First time opening: refresh the commit and log state after a delay
      setTimeout(() => {
        if (webviewView.visible) this.refreshState();
      }, 200);

      // Refresh both views when the Commit view becomes visible. The Commit view
      // and the bottom Git Log view own their visibility independently.
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          setTimeout(() => this.refreshState(), 100);
        }
      });
    });
  }

  private refreshState(): void {
    const runtime = this.repoRegistry.getActive();
    runtime?.gitService.cache.invalidate();
    this.messageRouter.broadcastEvent("commitStateChanged", {
      repoId: runtime?.descriptor.id,
    });
    this.messageRouter.broadcastEvent("gitStateChanged", {
      scope: "all",
      repoId: runtime?.descriptor.id,
    });
  }
}
