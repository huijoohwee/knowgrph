[OPEN] Storyboard Aborted Loads

## Session
- session_id: `storybook-aborted-loads`
- started_at: `2026-06-28`
- scope: Investigate the 10 `net::ERR_ABORTED` browser logs around workspace FS mirror loading, canvas tab sync modules, and media fetches in local dev.

## Symptoms
- Browser reports aborted requests for `__kg_fs_list`, several `src/features/canvas/*` and `src/features/chat/*` modules, one shared `@fs/*events.ts` import, and two media fetch URLs.
- Primary stack points at `readWorkspaceDocsMirrorEntriesViaProxy()` and `readWorkspaceInitializationDocsMirrorEntries()`.

## Hypotheses
- H1: A failing request in workspace mirror bootstrap causes the app to tear down or redirect the module graph, so dependent JS module fetches are cancelled rather than individually broken.
- H2: The dev server proxy route for `__kg_fs_list` is missing or conditionally unavailable in this route, triggering an initialization abort cascade.
- H3: Canvas/chat module imports are valid, but the browser aborts them because HMR/navigation state switches during startup after a synchronous exception in workspace seeding.
- H4: The media URLs are expiring or being revoked during startup retries, producing secondary aborted fetches unrelated to the source-code module path failures.
- H5: A recent tab-sync/workspace-seed refactor introduced an initialization race that starts requests and then cancels them when a competing bootstrap branch wins.

## Evidence Log
- Pre-fix evidence:
  - Multiple `readWorkspaceInitializationDocsMirrorEntries()` entries fired within the same millisecond for the same docs root.
  - Multiple `readWorkspaceDocsMirrorEntriesViaProxy()` calls ran concurrently against the same `/Users/huijoohwee/Documents/GitHub/huijoohwee/docs` root.
  - Proxy responses were healthy (`200`, `fileCount=39`), but startup launched duplicate heavy requests that overlapped for ~0.5s to ~0.9s.
- Post-fix evidence:
  - Bootstrap still re-enters, but duplicate callers now share one local docs-root proxy request per burst.
  - Clean reload no longer reproduced the earlier `ERR_ABORTED` cascade tied to `__kg_fs_list` fan-out.

## Hypothesis Status
- H1: Partially confirmed. The first trigger was not a missing route, but redundant docs-mirror bootstrap work that can cancel adjacent startup fetches during churn.
- H2: Rejected. `__kg_fs_list` is registered and returns `200`.
- H3: Rejected as primary root cause. No startup exception or redirect was required to reproduce the pressure.
- H4: Rejected as primary root cause. Media aborts appear secondary to the same startup churn.
- H5: Confirmed. A bootstrap race/duplication caused repeated identical docs-mirror reads.

## Fix
- Added source-level in-flight dedupe plus a 1s short-lived cache for the configured local docs-root dataset only.
- Kept storage-export behavior untouched in source; the fix scopes only to the local docs mirror proxy path.
- Added a focused regression test for burst reads against the configured docs root.

## Next
- Await user verification before removing instrumentation and debug artifacts.
