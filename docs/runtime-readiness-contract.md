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
  ref: "bac0812e4b1079c8015e7ffc4238d2e5f0717d7b"
  root_env: "KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT"
  default_relative_root: "../agentic-canvas-os/docs"
  required_files: ["FACTS.md", "DICTIONARY-COMMAND.md", "DICTIONARY-SEMANTIC.md", "DICTIONARY-BINDING.md", "START-WORKFLOW.md", "RELEASE-WORKFLOW.md", "RUNTIME-PROOF.md", "SKILLS.md"]
  proof_tokens: ["/runtime-ready.check", "/session.start", "/release.complete", "#runtime-ready", "#multi-agent-collaboration", "@operator", "@working-directory", "@source.frontmatter", "@runtime-proof", "@mcp-gateway", "/sandbox.policy.validate", "#agent-sandbox-policy", "@sandbox-policy"]
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

The opening frontmatter is the machine source of truth for the Dev runtime-readiness gate. The external Agentic Canvas OS dictionaries remain the invocation grammar SSOT, while `SKILLS.md` owns named `/*-agent` variants. This contract records only the pinned dependency and proof probes required by Knowgrph.

## Promotion Rule

`runtime-ready` is an executable claim. It requires the focused runtime suite, readable pinned dictionaries, canonical stage topology, deterministic replay, zero paid calls, zero actual cost, and proof bound to the current Git source state.

The local gate performs no network calls, deployments, remote migrations, or repository writes. Deployed reachability is a separate operator-invoked verification and cannot promote a failing local runtime.

## Cloudflare-Only Runtime Boundary

The deployed agent runtime requires only the `knowgrph-mcp` Worker, its Agents SDK Durable Objects, the `AI` Workers AI binding, and the `KNOWGRPH_AGENT_RUNTIME_BEARER_TOKEN` Worker secret. Agent definitions, schemas, plans, policies, and renderer contracts are bundled from `data/config/agents/agent-definitions.json`; request handling does not read another repository or call an external orchestration service.

The pinned Agentic Canvas OS documentation is a source-time governance dependency checked before promotion. It is not a request-time infrastructure dependency. BytePlus, Exa, StryTree, payment, and media services remain optional adapters for their existing specialized stages and are not required for `/investment-research-agent`, `/sme-care-agent`, or `/video-agent` to compile and dry-run.

Live execution is fail-closed: it requires bearer authentication, the `paid-model-call` approval, and a configured Workers AI binding. Dry-run is deterministic and records zero paid provider calls.

## Commands

```bash
npm run runtime:check
```

Pre-deployment secret configuration (operator action):

```bash
npx wrangler secret put KNOWGRPH_AGENT_RUNTIME_BEARER_TOKEN \
  --config cloudflare/workers/knowgrph-mcp/wrangler.toml
```

Post-deploy verification, only after explicit authorization and with explicit URLs:

```bash
FRONTEND_URL=https://example.invalid \
MCP_ENDPOINT=https://example.invalid/mcp \
npm run runtime:verify:deployed
```
