import { cleanup, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 28,
    getVirtualItems: () => [],
    scrollToIndex: vi.fn(),
  }),
}));

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
const { GitGraphPanel } = await import("./GitGraphPanel");
const panelStore = defaultGitLogStore.store;

function StoreWrapper({ children }: PropsWithChildren) {
  return (
    <GitLogStoreProvider store={panelStore}>{children}</GitLogStoreProvider>
  );
}

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  panelStore.setState({
    visibleCommits: [],
    commits: [],
    graphLayout: {},
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("GitGraphPanel scroll synchronization", () => {
  it("hides the graph when file history is active", () => {
    panelStore.setState({
      hasMore: false,
      loading: false,
      filter: {
        searchQuery: "",
        branch: "",
        author: "",
        dateRange: "",
        file: "src/example.ts",
      },
    });
    const view = render(<GitGraphPanel showGraph={false} />, {
      wrapper: StoreWrapper,
    });

    expect(view.container.querySelector("svg")).toBeNull();
    expect(view.getByLabelText("Commit list")).toBeTruthy();
  });

  it("moves the graph in the same scroll event as the commit list", () => {
    panelStore.setState({ hasMore: false, loading: false });
    const view = render(<GitGraphPanel />, { wrapper: StoreWrapper });
    const list = view.getByLabelText("Commit list");
    const graph = view.container.querySelector("svg > g");
    expect(graph?.getAttribute("transform")).toBe("translate(0, 0)");

    Object.defineProperty(list, "scrollTop", {
      configurable: true,
      value: 84,
    });
    list.dispatchEvent(new Event("scroll"));

    expect(graph?.getAttribute("transform")).toBe("translate(0, -84)");

    view.rerender(<GitGraphPanel />);

    expect(graph?.getAttribute("transform")).toBe("translate(0, -84)");
  });
});
