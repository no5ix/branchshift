import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/bridge", () => ({
  bridge: {
    request: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn(() => () => {}),
    setRepoContext: vi.fn(),
  },
}));

const { bridge } = await import("../../shared/bridge");
const { GitLogStoreProvider } = await import(
  "../../shared/store/git-log-store-context"
);
const { defaultGitLogStore } = await import("../../shared/store/panel-store");
const { useRepoStore } = await import("../../shared/store/repo-store");
const { BranchSidebar } = await import("./BranchSidebar");
const panelStore = defaultGitLogStore.store;

const originalSetFavorite = panelStore.getState().setFavorite;
const originalNavigateToRef = panelStore.getState().navigateToRef;

function StoreWrapper({ children }: PropsWithChildren) {
  return (
    <GitLogStoreProvider store={panelStore}>{children}</GitLogStoreProvider>
  );
}

function renderWithStore(ui: ReactElement) {
  return render(ui, { wrapper: StoreWrapper });
}

function deferredVoid() {
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  panelStore.setState({
    selectedRefs: [],
    branches: [],
    tags: [],
    setFavorite: originalSetFavorite,
    navigateToRef: originalNavigateToRef,
  });
  useRepoStore.setState({ activeRepoId: null });
});

describe("BranchSidebar ref actions", () => {
  it("exposes the action matching the current branch tree mode", () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    panelStore.setState({ branchGroupByDirectory: false });
    const { getByRole, rerender } = renderWithStore(<BranchSidebar />);

    const groupedButton = getByRole("button", { name: "Group By Directory" });
    const groupedIcon = groupedButton.querySelector("svg")?.outerHTML;
    expect(groupedIcon).toBeTruthy();

    act(() => panelStore.setState({ branchGroupByDirectory: true }));
    rerender(<BranchSidebar />);
    const flattenedIcon = getByRole("button", {
      name: "Flatten List",
    }).querySelector("svg")?.outerHTML;
    expect(flattenedIcon).toBeTruthy();
    expect(flattenedIcon).not.toBe(groupedIcon);
  });

  it("does not expose branch creation, deletion, update, or favorite actions in the sidebar", () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    const { queryByRole } = renderWithStore(<BranchSidebar />);

    for (const name of [
      "New Branch",
      "Update Selected",
      "Delete Branch",
      "Mark/Unmark As Favorite",
    ]) {
      expect(queryByRole("button", { name })).toBeNull();
    }
  });

  it("keeps Fetch available when a repository is active", () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    const { getByRole } = renderWithStore(<BranchSidebar />);
    expect((getByRole("button", { name: "Fetch" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables repository mutations when no repository is active", () => {
    useRepoStore.setState({ activeRepoId: null });
    panelStore.setState({
      selectedRefs: [
        { type: "local", name: "feature", fullRef: "refs/heads/feature" },
      ],
      branches: [
        {
          name: "feature",
          fullRef: "refs/heads/feature",
          isRemote: false,
          isFavorite: false,
          upstream: "origin/feature",
          lastCommitHash: "tip",
        } as never,
      ],
    });
    const { getByRole } = renderWithStore(<BranchSidebar />);

    for (const name of ["Fetch"]) {
      expect(
        (getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
    expect(
      (
        getByRole("button", {
          name: "Navigate Log to Selected Ref Head",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(getByRole("button", { name: "Branch Settings" })).toBeTruthy();
  });

  it("confirms and deletes all selected local branches in one batch", async () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    const firstRef = {
      type: "local",
      name: "feature/one",
      fullRef: "refs/heads/feature/one",
    } as const;
    const secondRef = {
      type: "local",
      name: "feature/two",
      fullRef: "refs/heads/feature/two",
    } as const;
    panelStore.setState({
      currentBranch: "main",
      selectedRefs: [firstRef, secondRef],
      branches: [
        {
          name: "main",
          fullRef: "refs/heads/main",
          isRemote: false,
          isCurrent: true,
          isFavorite: false,
          lastCommitHash: "main-tip",
        },
        {
          name: "feature/one",
          fullRef: firstRef.fullRef,
          isRemote: false,
          isCurrent: false,
          isFavorite: false,
          lastCommitHash: "one-tip",
        },
        {
          name: "feature/two",
          fullRef: secondRef.fullRef,
          isRemote: false,
          isCurrent: false,
          isFavorite: false,
          lastCommitHash: "two-tip",
        },
      ] as never[],
    });
    vi.mocked(bridge.request).mockResolvedValueOnce({ confirmed: true });
    const { getByRole } = renderWithStore(<BranchSidebar />);

    const deleteButton = getByRole("button", {
      name: "Delete Selected Branches (2)",
    });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(bridge.request).toHaveBeenCalledWith(
        "showConfirmMessage",
        {
          message: "Delete these 2 branches?\n\n• feature/one\n• feature/two",
          confirmLabel: "Delete 2 Branches",
        },
        { scope: "global" },
      );
      expect(bridge.request).toHaveBeenCalledWith(
        "deleteBranch",
        { branchName: "feature/one", isRemote: false, force: false },
        { repoId: "repo-a" },
      );
      expect(bridge.request).toHaveBeenCalledWith(
        "deleteBranch",
        { branchName: "feature/two", isRemote: false, force: false },
        { repoId: "repo-a" },
      );
    });
  });

  it("does not include the current branch or remote refs in batch deletion", () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    panelStore.setState({
      currentBranch: "main",
      selectedRefs: [
        { type: "local", name: "main", fullRef: "refs/heads/main" },
        {
          type: "local",
          name: "feature",
          fullRef: "refs/heads/feature",
        },
        {
          type: "remote",
          name: "origin/feature",
          fullRef: "refs/remotes/origin/feature",
        },
      ],
      branches: [
        {
          name: "main",
          fullRef: "refs/heads/main",
          isRemote: false,
          isCurrent: true,
          isFavorite: false,
          lastCommitHash: "main-tip",
        },
        {
          name: "feature",
          fullRef: "refs/heads/feature",
          isRemote: false,
          isCurrent: false,
          isFavorite: false,
          lastCommitHash: "feature-tip",
        },
        {
          name: "origin/feature",
          fullRef: "refs/remotes/origin/feature",
          isRemote: true,
          isCurrent: false,
          isFavorite: false,
          lastCommitHash: "remote-tip",
        },
      ] as never[],
    });
    const { getByRole } = renderWithStore(<BranchSidebar />);

    expect(
      (getByRole("button", { name: "Delete Branch" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      getByRole("button", { name: "Delete Branch" }).getAttribute("aria-label"),
    ).toBe("Delete Branch");
  });

  it("shows a typed Update failure message and recovery once", async () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    panelStore.setState({
      selectedRefs: [
        { type: "local", name: "feature", fullRef: "refs/heads/feature" },
      ],
      branches: [
        {
          name: "feature",
          fullRef: "refs/heads/feature",
          isRemote: false,
          isFavorite: false,
          upstream: "origin/feature",
          lastCommitHash: "tip",
        } as never,
      ],
    });
    vi.mocked(bridge.request).mockRejectedValueOnce(
      Object.assign(new Error("Repository unavailable"), {
        code: "REPO_NOT_FOUND",
        recovery: "Choose an available repository.",
      }),
    );
    const { getByRole } = renderWithStore(<BranchSidebar />);

    fireEvent.click(getByRole("button", { name: "Update Selected" }));

    await waitFor(
      () =>
        expect(bridge.request).toHaveBeenCalledWith(
          "showErrorNotification",
          {
            message:
              "Update failed: Repository unavailable\nChoose an available repository.",
          },
          { scope: "global" },
        ),
      { timeout: 2_000 },
    );
    expect(
      vi
        .mocked(bridge.request)
        .mock.calls.filter(([command]) => command === "showErrorNotification"),
    ).toHaveLength(1);
  });

  it("suppresses deferred failures after their ref or repository becomes stale", async () => {
    const featureRef = {
      type: "local",
      name: "feature",
      fullRef: "refs/heads/feature",
    } as const;
    useRepoStore.setState({ activeRepoId: "repo-a" });
    panelStore.setState({
      selectedRefs: [featureRef],
      branches: [
        {
          name: "feature",
          fullRef: "refs/heads/feature",
          isRemote: false,
          isFavorite: false,
          upstream: "origin/feature",
          lastCommitHash: "tip",
        } as never,
      ],
    });
    const pendingUpdate = deferredVoid();
    const pendingFetch = deferredVoid();
    vi.mocked(bridge.request)
      .mockImplementationOnce(() => pendingUpdate.promise)
      .mockImplementationOnce(() => pendingFetch.promise);
    const { getByRole } = renderWithStore(<BranchSidebar />);

    fireEvent.click(getByRole("button", { name: "Update Selected" }));
    fireEvent.click(getByRole("button", { name: "Fetch" }));
    await waitFor(() => {
      expect(bridge.request).toHaveBeenCalledWith(
        "updateBranch",
        { branchName: "feature" },
        { repoId: "repo-a" },
      );
      expect(bridge.request).toHaveBeenCalledWith("fetchAll", undefined, {
        repoId: "repo-a",
      });
    });

    act(() => {
      panelStore.setState({
        selectedRefs: [
          { type: "local", name: "other", fullRef: "refs/heads/other" },
        ],
        branches: [],
      });
    });
    await act(async () => {
      pendingUpdate.reject(
        Object.assign(new Error("Repository unavailable"), {
          code: "REPO_NOT_FOUND",
          recovery: "Choose an available repository.",
        }),
      );
      await pendingUpdate.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(
      vi
        .mocked(bridge.request)
        .mock.calls.filter(([command]) => command === "showErrorNotification"),
    ).toHaveLength(0);

    act(() => useRepoStore.setState({ activeRepoId: "repo-b" }));
    await act(async () => {
      pendingFetch.reject(
        Object.assign(new Error("Remote unavailable"), {
          code: "FETCH_FAILED",
          recovery: "Check the remote and try again.",
        }),
      );
      await pendingFetch.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(
      vi
        .mocked(bridge.request)
        .mock.calls.filter(([command]) => command === "showErrorNotification"),
    ).toHaveLength(0);
  });

  it("shows a typed Fetch failure message and recovery once", async () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    vi.mocked(bridge.request).mockRejectedValueOnce(
      Object.assign(new Error("Remote unavailable"), {
        code: "FETCH_FAILED",
        recovery: "Check the remote and try again.",
      }),
    );
    const { getByRole } = renderWithStore(<BranchSidebar />);

    fireEvent.click(getByRole("button", { name: "Fetch" }));

    await waitFor(() =>
      expect(bridge.request).toHaveBeenCalledWith(
        "showErrorNotification",
        {
          message:
            "Fetch failed: Remote unavailable\nCheck the remote and try again.",
        },
        { scope: "global" },
      ),
    );
    expect(
      vi
        .mocked(bridge.request)
        .mock.calls.filter(([command]) => command === "showErrorNotification"),
    ).toHaveLength(1);
  });

  it("allows tag favorites and navigation but disables branch-only actions", async () => {
    useRepoStore.setState({ activeRepoId: "repo-a" });
    const tag = {
      type: "tag",
      name: "v1.0.0",
      fullRef: "refs/tags/v1.0.0",
    } as const;
    const setFavorite = vi.fn().mockResolvedValue(undefined);
    const navigateToRef = vi.fn().mockResolvedValue(undefined);
    panelStore.setState({
      selectedRefs: [tag],
      tags: [
        {
          name: tag.name,
          fullRef: tag.fullRef,
          targetCommitHash: "tag-tip",
          isFavorite: false,
        } as never,
      ],
      setFavorite,
      navigateToRef,
    });
    const { getByRole, queryByRole } = renderWithStore(<BranchSidebar />);

    expect(
      (getByRole("button", { name: "Update Selected" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (getByRole("button", { name: "Delete Branch" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(queryByRole("button", { name: "Show My Branches" })).toBeNull();

    fireEvent.click(getByRole("button", { name: "Mark/Unmark As Favorite" }));
    fireEvent.click(
      getByRole("button", { name: "Navigate Log to Selected Ref Head" }),
    );

    await waitFor(() => {
      expect(setFavorite).toHaveBeenCalledWith(tag, true, "repo-a");
      expect(navigateToRef).toHaveBeenCalledWith(tag, "tag-tip");
    });
    expect(bridge.request).not.toHaveBeenCalledWith("showMyBranches");
  });
});
