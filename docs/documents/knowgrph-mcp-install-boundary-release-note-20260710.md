# Knowgrph MCP Install Boundary Release Note 2026-07-10

## Summary

Knowgrph now publishes one explicit operator-facing MCP install rule for remote hosts.

- Public install and discovery stay on `https://airvio.co/knowgrph/mcp`
- Approval-gated orchestration and live `/`, `#`, `@` grammar invocation stay on
  `https://airvio.co/knowgrph/control-plane/mcp`
- The canonical onboarding and host recipes now live in
  `docs/documents/knowgrph-mcp-install-contract.md`

This update is documentation-only. It does not change runtime ownership, route behavior, or MCP
tool registration.

For the one-page onboarding path across the install contract, agent-ready context, and MCP
overview, open `docs/documents/knowgrph-mcp-onboarding-index.md`.

## Shipped Change

- Added a dedicated install contract for ChatGPT, Claude, Vercel, Lovable, and generic MCP clients
- Linked that install contract from the repo README, the canonical agent-ready document, and the
  MCP overview
- Mirrored the same install-boundary note into the published docs overview
- Logged the new install boundary and doc-routing follow-ups in `todo-log.md`

## Why This Matters

Remote hosts should not have to guess which endpoint owns installation versus orchestration.

The new boundary keeps the public path simple and low-friction while preserving the separate
control-plane trust boundary for approval-gated or sessioned operations.

## Canonical Rule

Use:

- `https://airvio.co/knowgrph/mcp` for basic remote MCP installation, discovery, read-only
  retrieval, prompt discovery, resource discovery, and inspection
- `https://airvio.co/knowgrph/control-plane/mcp` only when the host can manage the MCP session flow
  and needs approval-gated orchestration or live `knowgrph.agentic_canvas_os.docs.invoke`

If a host cannot manage the second sessioned MCP surface, keep discovery on the public endpoint and
route grammar invocation through an app-owned forwarder.

## Source Of Truth

- Canonical install contract:
  `docs/documents/knowgrph-mcp-install-contract.md`
- Canonical agent-ready landing doc:
  `docs/documents/knowgrph-agent-ready-document.md`
- Canonical MCP overview:
  `docs/documents/knowgrph-mcp/knowgrph-mcp.md`
- Planning ledger:
  `todo-log.md`

## Guardrails

- Do not document `/knowgrph/mcp` as if it already exposes the control-plane grammar tool.
- Do not collapse public discovery and approval-gated orchestration into one install URL by copy.
- Do not claim universal one-URL plug-and-play grammar invocation for hosts that cannot manage MCP
  session lifecycle.
