import type { GitRefIdentity, GitRefType } from "../branchDashboardState";

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

const NAMED_REF_PREFIXES: readonly [string, GitRefType][] = [
  ["refs/heads/", "local"],
  ["refs/remotes/", "remote"],
  ["refs/tags/", "tag"],
];

/**
 * Rebuild the structured ref identity from the legacy plain `branch` log
 * parameter.
 *
 * The Git Log panel's branch filter travels as a bare full ref, while the
 * structured `revision` field carries a `GitRefIdentity`. Availability probes
 * answer with a structured ref, so a plain filter has to be re-derived to be
 * reported the same way: `{ status: "ref-unavailable", ref }` keeps the panel's
 * branch sidebar intact, whereas letting Git fail the query surfaces a raw
 * `fatal: ambiguous argument …` rejection that the store treats as a total load
 * failure.
 *
 * Returns `null` for anything that is neither an object id nor a supported
 * `refs/…` namespace, so callers can reject malformed parameters instead of
 * passing them to Git.
 */
export function refIdentityFromFullRef(
  fullRef: string | undefined,
): GitRefIdentity | null {
  if (!fullRef) {
    return null;
  }
  if (OBJECT_ID.test(fullRef)) {
    return { type: "detached", name: fullRef, fullRef };
  }
  for (const [prefix, type] of NAMED_REF_PREFIXES) {
    if (fullRef.startsWith(prefix) && fullRef.length > prefix.length) {
      return { type, name: fullRef.slice(prefix.length), fullRef };
    }
  }
  return null;
}
