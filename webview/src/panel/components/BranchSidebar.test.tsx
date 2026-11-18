import { act, cleanup, render } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/bridge", () => ({
  bridge: {
    request: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn(() => () => {}),
    setRepoContext: vi.fn(),
  },
}));

const { GitLogStoreProvider } = await import(
  "../../shared/store/git-log-store-context"
);
const { defaultGitLogStore } = await import("../../shared/store/panel-store");
const { useRepoStore } = await import("../../shared/store/repo-store");
const { BranchSidebar } = await import("./BranchSidebar");
const panelStore = defaultGitLogStore.store;

function StoreWrapper({ children }: PropsWithChildren) {
  return (
    <GitLogStoreProvider store={panelStore}>{children}</GitLogStoreProvider>
  );
}

function renderWithStore(ui: ReactElement) {
  return render(ui, { wrapper: StoreWrapper });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  panelStore.setState({
    selectedRefs: [],
    branches: [],
    tags: [],
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

  it("keeps Fetch and Navigate to Ref Head available in the sidebar", () => {
    const { getByRole } = renderWithStore(<BranchSidebar />);

    expect(getByRole("button", { name: "Fetch" })).toBeTruthy();
    expect(
      getByRole("button", { name: "Navigate Log to Selected Ref Head" }),
    ).toBeTruthy();
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
});
