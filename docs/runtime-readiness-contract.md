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
  ref: "4d516b1308fcffb5c2b32ef13273755cc698fd29"
  root_env: "KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT"
  default_relative_root: "../agentic-canvas-os/docs"
  required_files: ["FACTS.md", "DICTIONARY-COMMAND.md", "DICTIONARY-SEMANTIC.md", "DICTIONARY-BINDING.md", "START-WORKFLOW.md", "RELEASE-WORKFLOW.md", "CANONICAL-LIFECYCLE.md", "RUNTIME-PROOF.md", "LIVE-AGENT-PROVIDER-PROOF.md", "PROGRESSIVE-AGENTS.md", "AGENT-TOOLKIT.md", "APPLICATION-COMPOSITION.md", "KNOWLEDGE-GRAPH.md", "SKILLS.md", "schemas/production-runtime-readiness.v2.schema.json"]
  proof_tokens: ["/runtime-ready.check", "/session.start", "/release.complete", "/knowgrph.probe-tree", "/implementation.run", "/application.compose", "/knowledge.graph.ingest", "/knowledge.graph.query", "/knowledge.graph.explain", "/ecs.session-start", "/ecs.world-tick", "/ecs.decision-persist", "/agent.toolkit", "/camera.select", "/xr.stage", "/xr.place", "/xr.transform", "/xr.label", "/xr.remove", "/xr.physics", "/xr.present", "#runtime-ready", "#multi-agent-collaboration", "#knowgrph.probe-tree", "#managed-implementation-run", "#application-composition", "#knowledge-graph", "#agentic-ecs", "#agent-toolkit", "#transform", "#world", "#body", "#impulse", "#controller", "#reticle", "@operator", "@working-directory", "@work-item", "@implementation-run", "@application-manifest", "@component-catalog", "@integration-profile", "@knowledge-graph", "@source.frontmatter", "@runtime-proof", "@knowgrph.probe-tree", "@mcp-gateway", "@ecs-session", "@agent-toolkit-observer", "@scene", "/sandbox.policy.validate", "#agent-sandbox-policy", "@sandbox-policy"]
local_proof:
  provider_mode: "mock"
  network_allowed: false
  repository_writes_allowed: false
  paid_call_count: 0
  actual_cost_usd: 0
  deterministic_replays: 2
sme_canvas_evidence:
  fixture: "sme-agent/fixtures/pre-seed.md"
  artifact: "sme-agent/demo/sme-care-agent-canvas-evidence.md"
  invocation: "/sme-care-agent"
  schema: "knowgrph-sme-canvas-evidence/v1"
  kgc_schema: "kgc-computing-flow/v1"
  renderer: "storyboard"
deployed_verification:
  script: "scripts/verify-deployed-runtime.mjs"
  explicit_environment_only: true
  required_environment: ["FRONTEND_URL", "MCP_ENDPOINT"]
---

# Knowgrph Runtime Readiness Contract

## Authority

The opening frontmatter is the machine source of truth for the Dev runtime-readiness gate. Agentic Canvas OS `SKILLS.md` governs lightweight agent-variant catalog membership, while Knowgrph's validated registry owns its exact agent IDs and derived `/*-agent` invocations. The external dictionaries remain the shared token grammar SSOT without duplicating each runtime registry. This contract records the only Agentic Canvas OS repository and revision pin; Integration, runtime-verification, and release-verification workflows resolve their checkout inputs from it instead of copying the SHA, and fetch full local history so the network-free gate can prove the live-proof introduction revision.

The pinned `schemas/production-runtime-readiness.v2.schema.json` is the public release-attestation SSOT. A protected Knowgrph release must validate one byte-identical marker for `/`, `/knowgrph`, and the generated mirror; the marker binds the Knowgrph commit and tree, Agentic Canvas OS docs/catalog revision, immutable-manifest digest, and deterministic browser-artifact digest. Knowgrph remains the only `airvio.co` deployment owner. The verify job pins the production mirror's base revision, includes the reviewed hidden readiness files in the artifact, and records every managed deletion. The deploy job checks out that exact base and reconciles the verified additions, replacements, and deletions before Cloudflare deployment; an overlay that retains an older asset namespace or omits the nested marker fails closed. The release first proves the custom-domain routes, storage, and reconciled docs through the live smoke. It then reads both marker routes and runs the Home/app Chromium proof on the exact successful `*.joohwee.pages.dev` deployment returned by the Cloudflare API for the protected SHA. That candidate uses the canonical `airvio.co` storage owner and keeps its nested canvas on the same exact deployment, so shared-document hydration, Home, `/knowgrph`, and every JavaScript response remain bound to the release-SHA namespace. Vite's application and worker Rollup outputs share the same revision-scoped filename policy; an unversioned worker bundle fails browser fidelity just like an unversioned application chunk. This transport separation prevents a GitHub-hosted runner's custom-domain challenge from masquerading as application drift without weakening custom-domain live proof, shared-document fidelity, immutable marker acceptance, or automatic rollback.

The apex Home owner ignores non-routing release, trace, canvas-background, and editor-visibility parameters, including `kgReleaseProof`, `kgTrace`, the `kgCanvas*` render selectors, and a shared-document `kgPath`. These parameters may configure or attest Home but cannot silently transfer route ownership to the workspace. A direct `/knowgrph/` alias or a document-preview route remains workspace-owned and suppresses Home.

The pinned `AGENT-TOOLKIT.md` and its `/agent.toolkit #agent-toolkit @agent-toolkit-observer` grammar expose the native Toolkit boundary without copying its implementation. Agentic Canvas OS remains the sole execution, instrumentation, evaluation, and reviewed-learning owner; Knowgrph performs read-only catalog resolution and adds no request-time service or external Toolkit dependency.

The pinned `APPLICATION-COMPOSITION.md` and its `/application.compose #application-composition @application-manifest @component-catalog @integration-profile @runtime-proof` grammar govern provider-neutral composition. Knowgrph implements the independent local catalog, mode-bound immutable planner, and bounded sequencer through `knowgrph.application.catalog`, `knowgrph.application.plan`, and `knowgrph.application.execute`. Catalog and plan make zero model or external calls. Execute replans and digest-fences the exact source, revisions, schemas, capabilities, owners, and adapters before delegating each step. Its closed top-level MCP arguments never accept a caller adapter, provider, transport, approval array, or raw tool result, and built-in component schemas expose no caller command, endpoint, or credential fields. Embedding hosts may admit bounded source-bound JSON component packs only through the private initialization API; extension `node.config` remains governed by the selected closed schema and host review, while MCP cannot register a pack, adapter, resolver, package, URL, or executable. This integration copies no external implementation and adds no request-time Agentic Canvas OS, Symphony, or LangChain dependency.

The pinned `KNOWLEDGE-GRAPH.md` supplies the exact `/knowledge.graph.*` command, `#knowledge-graph #mcp` semantic, operation-specific proof semantic, and bounded `@knowledge-graph` binding tuples. Knowgrph independently owns the three local stdio tools, bounded filesystem admission, deterministic source parsers, canonical explained-edge artifact, lexical graph query, and stored edge explanation. Dictionary lookup is metadata-only. Ingestion, query, and explanation use no model, embedding, vector store, external graph service, Graphify runtime, or network fallback.

## Promotion Rule

`runtime-ready` is an executable claim. It requires the focused runtime suite, readable pinned dictionaries, canonical stage topology, deterministic replay, zero paid calls, zero actual cost, proof bound to the current Git source state, and a byte-stable `/sme-care-agent` Canvas evidence artifact that parses through the shared frontmatter-flow path.

The local gate performs no network calls, deployments, remote migrations, or repository writes. Deployed reachability is a separate operator-invoked verification and cannot promote a failing local runtime.

The Agentic ECS tokens resolve from the pinned Agentic Canvas OS dictionaries, while executable ownership remains in Knowgrph. Its three local stdio operations are `dev-only`; the canonical server injects no systems, decision executor, model route, network path, or deployment capability. The default lifecycle is KGC hydration, one successful zero-system/no-reasoning tick with a canonical zero Cost_Log, and zero-pending disposal. Reviewed embedding hosts may inject systems and an optional decision executor only through runtime construction, never through MCP arguments.

## Cloudflare-Only Runtime Boundary

The deployed agent runtime requires only the `knowgrph-mcp` Worker, its Agents SDK Durable Objects, the `AI` Workers AI binding, the `KNOWGRPH_AGENT_RUNTIME_BEARER_TOKEN` Worker secret, and an operator-selected `KNOWGRPH_AGENT_MODEL_ID`. The model identifier has no repository default. Agent definitions, schemas, plans, policies, and renderer contracts are bundled from `data/config/agents/agent-definitions.json`; request handling does not read another repository or call an external orchestration service.

The pinned Agentic Canvas OS documentation is a source-time governance dependency checked before promotion. It is not a request-time infrastructure dependency. BytePlus, Exa, StryTree, payment, and media services remain optional adapters for their existing specialized stages and are not required for `/investment-research-agent`, `/sme-care-agent`, or `/video-agent` to compile and dry-run.

The reviewed Function Calling proof uses the separate `env.dev` Worker named `knowgrph-mcp-dev`. That environment repeats the MCP and Run Manifest Durable Object bindings, keeps `KNOWGRPH_LIVE_CLIENTS="0"`, serves only a `workers.dev` hostname, and declares no `airvio.co` route. Its Dev-only bearer authenticates both the Agentic service client and the proof manifest read-back. The top-level production routes and deploy command remain a separate gate.

The accepted 2026-07-19 proof is bound to Agentic Canvas OS revision `a7ac73f427c10957b37d016e6a55592b578c381f` and its canonical `LIVE-REVIEWED-FUNCTION-PROOF.md`. One recovered durable continuation completed one logical `gpt-5.6-luna` run in two Responses requests and one signed reviewed call. Knowgrph returned an `applied` native receipt, and authenticated read-back found the exact note at revision 1. Aggregate returned usage was 546 input and 55 output tokens with USD 0.000876 estimated cost. The evidence proves only this route-free Dev lane; no production route, Pages deployment, custom domain, or live stage client changed.

Live execution is fail-closed. `/sme-care-agent` is the single prepared definition: its text and complete/per-run transport requirements pass to the Workers AI resolver, which returns a versioned provider/model/transport packet. The runtime then resolves the packet's exact adapter id from the immutable Running Agents registry. Missing approval, binding, model id, incompatible packet, or adapter blocks before dispatch. The other definitions remain deterministic dry-run only until they declare and prove their own model requirements.

`/sme-care-agent` additionally owns the internal `agent.sme` / `sme.risk.profile` deterministic kernel. Its Cloudflare bundle compiles without an external orchestration service, while its full Dev execution uses the existing local Source Files owner for atomic `sme-agent/profiles/*` and `sme-agent/runs/*` writes. Every successful live run includes `sme-agent/runs/<runId>/canvas-evidence.md`, a `kgc-computing-flow/v1` Storyboard projection of exposures, gaps, unknown risks, protection guidance, rationales, cost, and deployment boundaries. The checked-in pre-seed evidence mirror is regenerated from the same runtime owner and must remain byte-identical. Prod mirror and Cloudflare mutations remain prohibited until separately authorized.

## Commands

```bash
npm run runtime:docs-dependency:resolve
npm run worktree:lifecycle:check
npm run runtime:check
```

Pre-deployment secret configuration (operator action):

```bash
npx wrangler secret put KNOWGRPH_AGENT_RUNTIME_BEARER_TOKEN \
  --config cloudflare/workers/knowgrph-mcp/wrangler.toml
npx wrangler secret put KNOWGRPH_AGENT_MODEL_ID \
  --config cloudflare/workers/knowgrph-mcp/wrangler.toml
```

Isolated reviewed-function proof preparation, only after explicit Dev deploy approval:

```bash
npx wrangler secret put KNOWGRPH_AGENT_RUNTIME_BEARER_TOKEN \
  --config cloudflare/workers/knowgrph-mcp/wrangler.toml --env dev
npm --prefix cloudflare/workers/knowgrph-mcp run deploy:dev
```

Post-deploy verification, only after explicit authorization and with explicit URLs:

```bash
FRONTEND_URL=https://example.invalid \
MCP_ENDPOINT=https://example.invalid/mcp \
npm run runtime:verify:deployed
```
