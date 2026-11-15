import type { GitRefIdentity } from "../git/branchDashboardState";
import type { GitService } from "../git/gitService";
import { refIdentityFromFullRef } from "../git/refs/refIdentity";
import type { LogOptions, LogRevision } from "../git/types";
import type { MessageRouter } from "./messageRouter";
import type {
  LogQueryParams,
  LogQueryResult,
  LogQueryRevision,
  RequestContext,
} from "./protocol";

const NOT_GIT_REPO = { status: "not_git_repo" as const, data: null };

export function registerLogHandlers(router: MessageRouter): void {
  router.handle("getGraphData", (params, context) =>
    handleGraphPage("getGraphData", params, context),
  );
  router.handle("loadMoreLog", (params, context) =>
    handleGraphPage("loadMoreLog", params, context),
  );
  router.handle("getLog", async (params, context) => {
    if (!context) return NOT_GIT_REPO;
    return context.gitService.getLog(
      params as Record<string, unknown> & { maxCount?: number },
    );
  });
}

async function handleGraphPage(
  command: "getGraphData" | "loadMoreLog",
  rawParams: Record<string, unknown>,
  context: RequestContext | undefined,
): Promise<unknown> {
  if (!context) return NOT_GIT_REPO;
  const params = rawParams as LogQueryParams;
  const structured =
    params.revision !== undefined || params.currentRef !== undefined;
  const revision = params.revision
    ? await resolveRevision(context.gitService, params.revision)
    : undefined;
  if (revision && "unavailable" in revision) {
    return unavailable(revision.unavailable);
  }

  if (params.currentRef) {
    assertRefIdentity(params.currentRef);
    if (
      !(await context.gitService.resolveCommitRef(params.currentRef.fullRef))
    ) {
      return unavailable(params.currentRef);
    }
  }

  // The branch filter is the one log parameter with no availability probe: it is
  // appended to argv verbatim (`appendRevision`), so a branch deleted while the
  // panel was filtered on it made `git log refs/heads/<gone>` fail with
  // `fatal: ambiguous argument …`. That rejection propagated through the bridge
  // and the panel store cleared the commits, branches AND tags it had already
  // fetched, leaving the sidebar empty until the window was reloaded. Probe it
  // like the structured refs so the store's existing `ref-unavailable` handling
  // runs instead.
  if (!params.revision && params.branch) {
    const filterRef = refIdentityFromFullRef(params.branch);
    if (!filterRef) {
      throw new Error(`Invalid Git branch ref: ${params.branch}`);
    }
    if (!(await context.gitService.resolveCommitRef(filterRef.fullRef))) {
      return unavailable(filterRef);
    }
  }

  const maxCount =
    command === "loadMoreLog"
      ? (params.count ?? params.maxCount ?? 200)
      : (params.maxCount ?? 200);
  const options: LogOptions = {
    maxCount,
    skip: command === "loadMoreLog" ? (params.skip ?? 0) : params.skip,
    revision: revision && "value" in revision ? revision.value : undefined,
    ...(params.revision ? {} : { branch: params.branch }),
    search: params.search,
    author: params.author,
    since: params.since,
    until: params.until,
    file: params.file,
  };
  const result = await context.gitService.getGraphTopology(
    options,
    params.snapshot,
    params.currentRef?.fullRef,
  );
  if (!structured) return result;

  const response: LogQueryResult = {
    status: "ok",
    ...result,
    hasMore: result.graphData.commits.length >= maxCount,
  };
  return response;
}

async function resolveRevision(
  service: GitService,
  revision: LogQueryRevision,
): Promise<{ value: LogRevision } | { unavailable: GitRefIdentity }> {
  switch (revision.kind) {
    case "all":
      return { value: revision };
    case "ref":
      assertRefIdentity(revision.ref);
      if (!(await service.resolveCommitRef(revision.ref.fullRef))) {
        return { unavailable: revision.ref };
      }
      return { value: { kind: "ref", ref: revision.ref.fullRef } };
    case "range":
      for (const ref of [revision.excludeRef, revision.includeRef]) {
        assertRefIdentity(ref);
        if (!(await service.resolveCommitRef(ref.fullRef))) {
          return { unavailable: ref };
        }
      }
      return {
        value: {
          kind: "range",
          excludeRef: revision.excludeRef.fullRef,
          includeRef: revision.includeRef.fullRef,
        },
      };
  }
}

function assertRefIdentity(ref: GitRefIdentity): void {
  if (
    !ref ||
    !["local", "remote", "tag", "detached"].includes(ref.type) ||
    typeof ref.name !== "string" ||
    !ref.name ||
    typeof ref.fullRef !== "string" ||
    !ref.fullRef
  ) {
    throw new Error("Invalid structured Git ref");
  }
}

function unavailable(ref: GitRefIdentity): LogQueryResult {
  return { status: "ref-unavailable", ref };
}
