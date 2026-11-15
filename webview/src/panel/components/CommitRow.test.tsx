import { cleanup, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/bridge", () => ({
  bridge: {
    request: vi.fn().mockResolvedValue([]),
    onEvent: vi.fn(() => () => {}),
    setRepoContext: vi.fn(),
  },
}));

const { GitLogStoreProvider } = await import(
  "../../shared/store/git-log-store-context"
);
const { defaultGitLogStore } = await import("../../shared/store/panel-store");
const { CommitRow } = await import("./CommitRow");
const panelStore = defaultGitLogStore.store;

function StoreWrapper({ children }: PropsWithChildren) {
  return (
    <GitLogStoreProvider store={panelStore}>{children}</GitLogStoreProvider>
  );
}

afterEach(() => {
  cleanup();
  panelStore.setState({ selectedCommitHashes: [] });
});

describe("CommitRow reachability styling", () => {
  it("marks reachable commits while retaining selected-row priority", () => {
    const commit = {
      hash: "abc123",
      shortHash: "abc123",
      parents: [],
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorDate: "2026-07-18T00:00:00.000Z",
      subject: "Reachable commit",
      body: "",
      refs: [],
      reachableFromCurrent: true,
    };
    panelStore.setState({ selectedCommitHashes: [commit.hash] });

    const { getByText } = render(
      <CommitRow
        commit={commit}
        lane={{ column: 0, color: 0, lines: [] }}
        rowMaxColumn={0}
        columnWidths={{ author: 100, date: 130, hash: 70 }}
        visibleColumns={{ author: true, date: true, hash: true }}
        onCommitClick={() => {}}
      />,
      { wrapper: StoreWrapper },
    );
    const row = getByText("Reachable commit").closest(".selectable-row");

    expect(row?.classList.contains("current-reachable")).toBe(true);
    expect(row?.classList.contains("selected")).toBe(true);
  });

  it("reserves the same resize gutter before every visible metadata column", () => {
    const commit = {
      hash: "def456",
      shortHash: "def456",
      parents: [],
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorDate: "2026-07-18T00:00:00.000Z",
      subject: "Aligned commit",
      body: "",
      refs: [],
    };

    const { getByText } = render(
      <CommitRow
        commit={commit}
        lane={{ column: 0, color: 0, lines: [] }}
        rowMaxColumn={0}
        columnWidths={{ author: 100, date: 130, hash: 70 }}
        visibleColumns={{ author: true, date: true, hash: true }}
        onCommitClick={() => {}}
      />,
      { wrapper: StoreWrapper },
    );
    const row = getByText("Aligned commit").closest(".commit-row");
    const gutters = row?.querySelectorAll("[data-commit-column-gutter]");

    expect(gutters?.length).toBe(3);
    expect(
      [...(gutters ?? [])].every(
        (gutter) => (gutter as HTMLElement).style.width === "9px",
      ),
    ).toBe(true);
  });

  it("left-aligns the date value within its metadata column", () => {
    const commit = {
      hash: "date123",
      shortHash: "date123",
      parents: [],
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorDate: "2026-07-18T00:00:00.000Z",
      subject: "Date alignment",
      body: "",
      refs: [],
    };

    const { getByText } = render(
      <CommitRow
        commit={commit}
        lane={{ column: 0, color: 0, lines: [] }}
        rowMaxColumn={0}
        columnWidths={{ author: 100, date: 130, hash: 70 }}
        visibleColumns={{ author: true, date: true, hash: true }}
        onCommitClick={() => {}}
      />,
      { wrapper: StoreWrapper },
    );

    const date = getByText("2026-07-18 08:00");
    expect((date as HTMLElement).style.textAlign).toBe("left");
  });
  it("shows each remote/local branch pair at the same commit", () => {
    const commit = {
      hash: "refs123",
      shortHash: "refs123",
      parents: [],
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorDate: "2026-07-18T00:00:00.000Z",
      subject: "Multiple refs",
      body: "",
      refs: [
        { type: "branch" as const, name: "main" },
        { type: "remote-branch" as const, name: "origin/main" },
        { type: "branch" as const, name: "fix/picker-card-hover-highlight" },
        {
          type: "remote-branch" as const,
          name: "origin/fix/picker-card-hover-highlight",
        },
      ],
    };

    const { getByText } = render(
      <CommitRow
        commit={commit}
        lane={{ column: 0, color: 0, lines: [] }}
        rowMaxColumn={0}
        columnWidths={{ author: 100, date: 130, hash: 70 }}
        visibleColumns={{ author: true, date: true, hash: true }}
        onCommitClick={() => {}}
      />,
      { wrapper: StoreWrapper },
    );

    expect(
      getByText("origin & main, origin & fix/picker-card-hover-highlight"),
    ).toBeTruthy();
  });
  it("puts main refs before other branches at the same commit", () => {
    const commit = {
      hash: "main-first",
      shortHash: "mainfirst",
      parents: [],
      authorName: "Ada",
      authorEmail: "ada@example.com",
      authorDate: "2026-07-18T00:00:00.000Z",
      subject: "Main and feature refs",
      body: "",
      refs: [
        { type: "branch" as const, name: "feature/example" },
        { type: "remote-branch" as const, name: "origin/feature/example" },
        { type: "branch" as const, name: "main" },
        { type: "remote-branch" as const, name: "origin/main" },
      ],
    };

    const { getByText } = render(
      <CommitRow
        commit={commit}
        lane={{ column: 0, color: 0, lines: [] }}
        rowMaxColumn={0}
        columnWidths={{ author: 100, date: 130, hash: 70 }}
        visibleColumns={{ author: true, date: true, hash: true }}
        onCommitClick={() => {}}
      />,
      { wrapper: StoreWrapper },
    );

    expect(getByText("origin & main, origin & feature/example")).toBeTruthy();
  });
});
