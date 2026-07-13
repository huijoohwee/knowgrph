---
title: "Knowgrph Runtime Readiness Contract"
doc_type: "Runtime Contract"
status: "active"
contract_version: 1
frontmatter_contract: "required"
invocation:
  action: "/runtime-ready.check"
  semantic: "#runtime-ready"
  actor: "@local-harness"
stage_contract:
  module: "mcp/video-remix/stage-contract.js"
  order: ["research", "storyboard", "render", "edit", "publish", "checkout"]
docs_dependency:
  repository: "https://github.com/huijoohwee/agentic-canvas-os.git"
  ref: "97c3a48be4515c017f56a199bf59a0652e04d57b"
  root_env: "KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT"
  default_relative_root: "../agentic-canvas-os/docs"
  required_files: ["FACTS.md", "DICTIONARY-COMMAND.md", "DICTIONARY-SEMANTIC.md", "DICTIONARY-BINDING.md"]
  proof_tokens: ["/runtime-ready.check", "#runtime-ready", "@mcp-gateway", "/sandbox.policy.validate", "#agent-sandbox-policy", "@sandbox-policy"]
local_proof:
  provider_mode: "mock"
  network_allowed: false
  repository_writes_allowed: false
  paid_call_count: 0
  actual_cost_usd: 0
  deterministic_replays: 2
deployed_verification:
  script: "scripts/verify-deployed-runtime.mjs"
  explicit_environment_only: true
  required_environment: ["FRONTEND_URL", "MCP_ENDPOINT"]
---

# Knowgrph Runtime Readiness Contract

## Authority

The opening frontmatter is the machine source of truth for the Dev runtime-readiness gate. The external Agentic Canvas OS dictionaries remain the invocation grammar SSOT; this contract records only the pinned dependency and proof probes required by Knowgrph.

## Promotion Rule

`runtime-ready` is an executable claim. It requires the focused runtime suite, readable pinned dictionaries, canonical stage topology, deterministic replay, zero paid calls, zero actual cost, and proof bound to the current Git source state.

The local gate performs no network calls, deployments, remote migrations, or repository writes. Deployed reachability is a separate operator-invoked verification and cannot promote a failing local runtime.

## Commands

```bash
npm run runtime:check
```

Post-deploy verification, only after explicit authorization and with explicit URLs:

```bash
FRONTEND_URL=https://example.invalid \
MCP_ENDPOINT=https://example.invalid/mcp \
npm run runtime:verify:deployed
```
