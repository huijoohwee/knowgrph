---
schema: kgc-computing-flow/v1
id: knowgrph-mcp-onboarding-index
version: 1.0.0
status: implemented
created: 2026-07-10
updated: 2026-07-10
author: airvio / joohwee
domain: knowgrph
doc_type: "Onboarding Index"
frontmatter_contract: required
canonical_service_url: "https://airvio.co/knowgrph/"
public_read_mcp_url: "https://airvio.co/knowgrph/mcp"
control_plane_mcp_url: "https://airvio.co/knowgrph/control-plane/mcp"
tags: [mcp, onboarding, index, discovery, control-plane, operator]
constraints:
  - solo-dev
  - source-owned
  - token-efficient
  - fail-closed
related:
  - docs/documents/knowgrph-mcp-install-contract.md
  - docs/documents/knowgrph-mcp-install-boundary-release-note-20260710.md
  - docs/documents/knowgrph-agent-ready-document.md
  - docs/documents/knowgrph-mcp/knowgrph-mcp.md
---

# Knowgrph MCP Onboarding Index

## Purpose

This is the one-stop landing page for remote MCP onboarding.

Use it when you need one short path to:

- choose the correct Knowgrph MCP endpoint
- understand the public discovery vs control-plane split
- find the canonical install contract
- scan the latest install-boundary release note

## Quick Answer

- Install `https://airvio.co/knowgrph/mcp` for public discovery and read-only MCP usage
- Use `https://airvio.co/knowgrph/control-plane/mcp` only for approval-gated orchestration and
  live `/`, `#`, `@` grammar invocation

## Recommended Reading Order

1. `docs/documents/knowgrph-mcp-install-contract.md`
   - Canonical install rule, host recipes, and dual-surface boundary
2. `docs/documents/knowgrph-mcp-install-boundary-release-note-20260710.md`
   - Recent-change summary for the new install boundary
3. `docs/documents/knowgrph-agent-ready-document.md`
   - Broader agent-ready surface, trust boundary, and discovery context
4. `docs/documents/knowgrph-mcp/knowgrph-mcp.md`
   - Full MCP topology, readiness scope, and current implementation truth

## Which Doc To Open

| Need | Open |
|---|---|
| I just need the right install URL | `docs/documents/knowgrph-mcp-install-contract.md` |
| I want the shortest update summary | `docs/documents/knowgrph-mcp-install-boundary-release-note-20260710.md` |
| I want the larger discovery and readiness context | `docs/documents/knowgrph-agent-ready-document.md` |
| I want the MCP-specific architecture and scope | `docs/documents/knowgrph-mcp/knowgrph-mcp.md` |

## Canonical Endpoint Rule

| Surface | URL | Use |
|---|---|---|
| Public discovery | `https://airvio.co/knowgrph/mcp` | Install, discovery, read-only retrieval, prompts, resources, inspection |
| Control plane | `https://airvio.co/knowgrph/control-plane/mcp` | Approval-gated orchestration, live grammar invocation, sessioned MCP flows |

## Guardrails

- Do not treat `/knowgrph/mcp` as if it already exposes the control-plane grammar tool.
- Do not document both URLs as interchangeable install targets.
- Do not claim one-URL plug-and-play grammar invocation for hosts that cannot manage MCP session flow.
