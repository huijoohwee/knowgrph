# Topology Decision — knowgrph ↔ agentic-canvas-os connector (PRD MECE gap #1)

**Status:** Decided (task 12.6)
**Date:** 2026-06-09
**Spec:** `.kiro/specs/knowgrph-acos-mcp-connector`
**Resolves:** PRD/TAD `Readiness Gap Matrix` › "Repo topology + SSOT" (P0)

## Context

The PRD/TAD describes `knowgrph` (Cloudflare control plane) and
`agentic-canvas-os` (AWS + Vercel product) as two distinct repos. On disk:

- `/Users/huijoohwee/Documents/GitHub/agentic-canvas-os` is an **empty git repo**
  (no commits, no tracked files).
- The entire connector — AWS Agent-API (`aws/agent-api`), Vercel frontend
  (`web/`), the Cloudflare `McpAgent` worker (`cloudflare/workers/knowgrph-mcp`),
  the Director runtime + harnesses (`mcp/video-remix/*`), and the shared
  contracts (`contracts/*`) — is implemented and tested **inside `knowgrph`**.

## Decision

**`knowgrph` is the single source of truth (monorepo) for the connector.** The
`agentic-canvas-os` product tiers live as sub-trees within `knowgrph`:

| Tier | Location (SSOT) |
|---|---|
| Control plane (Cloudflare) | `cloudflare/workers/knowgrph-mcp`, `mcp/video-remix/*`, `mcp/video-remix-runtime.js` |
| Product backend (AWS) | `aws/agent-api` |
| Product frontend (Vercel) | `web/` |
| Shared contracts | `contracts/` |

The standalone `agentic-canvas-os` repo remains a **future split target**, not a
prerequisite for runtime readiness. The stack-boundary rule (R11) is enforced by
directory ownership + the secret-scan smoke tests, not by repo separation: the
AWS/Vercel tiers hold no model keys and forward all spend-bearing actions to the
Cloudflare control plane regardless of where the source lives.

## Rationale

- **Reuse over rebuild / KISS / tco-zero** (project lenses): the embedded
  implementation is complete and green (1000+ local tests). Splitting now adds
  cross-repo CI, versioning, and release coordination for zero runtime benefit.
- **No drift**: one repo means the MCP contract consumed by AWS/Vercel and the
  contract served by the control plane cannot diverge across repo boundaries.
- **Deployability is unaffected**: each tier deploys from its sub-tree —
  `npm run mcp:worker:deploy` (Cloudflare), `npm run agent-api:cdk:deploy`
  (AWS), `npm run web:build` + Vercel (frontend). See the deploy runbook.

## Consequences / follow-ups

1. The PRD/TAD `repos.product` field and the "two distinct repos" prose should be
   annotated to say the product tiers are currently embedded in `knowgrph` (this
   doc is the SSOT for that until the PRD is updated). The PRD is the user's
   canonical document and is left unedited here by design.
2. If a true split is later required, move `aws/agent-api`, `web/`, and the
   `contracts/` package into the `agentic-canvas-os` repo and publish `contracts`
   as a shared package; nothing else in the architecture changes.
3. Deployment commands and the demo narrative reference the `knowgrph` paths
   above (see `npm run` scripts + `scripts/verify-deployed-runtime.mjs`).

---

# AgentCore Runtime artifact shape (PRD R11 audit, task 13.0)

**Status:** Decided (task 13.0 — BLOCKING audit decision)
**Date:** 2026-06-09
**Spec:** `.kiro/specs/knowgrph-acos-mcp-connector`
**Resolves:** R11.1, R11.2, R11.5 (stack-boundary / spend-isolation) audit for the AWS AgentCore deployment-readiness work (Section 13)
**Cross-ref:** `design.md` › Open Decisions › Resolved Decisions ("AgentCore Runtime artifact shape under R11")

## Context

Section 13 of the spec makes the AWS AgentCore Runtime deployment
agent-authorable (container, CLI config, IAM role, inbound-auth, observability,
liveness). Before that work proceeds, the audit must pin down **what the
AgentCore Runtime artifact actually is** — because AgentCore can host either a
thin forwarding adapter or a full Bedrock-model-invoking reasoning agent, and
the two have opposite implications for the R11 spend-isolation boundary.

## Decision

**The AgentCore Runtime artifact is a thin MCP-forwarding adapter — NOT a
Bedrock-model-invoking reasoning agent.** It forwards `knowgrph.video_remix.run`
plus the stage tools (`research`, `storyboard`, `render`, `publish`,
`checkout`) to the Cloudflare `McpAgent` over MCP Streamable HTTP, exactly as the
API Gateway + Lambda Agent_Api adapter does. Concretely:

- **AWS holds no model keys** in any config, environment value, request, or
  response (R11.1, R11.5).
- **AWS invokes no paid model directly.** Every reasoning and spend-bearing
  action is forwarded to the Cloudflare control plane, which remains the only
  tier that holds model keys and calls paid models (R11.2, R11.5).
- **AWS Bedrock model invocation stays off the MVP path**, consistent with PRD
  **ADR-3** ("the Lambda is a thin adapter that forwards to the control-plane
  `McpAgent`. AWS holds no model keys; AWS Bedrock is deferred/optional, not on
  the MVP path").

The AgentCore Runtime artifact is therefore behaviorally identical to the
existing Agent_Api adapter — same forward-only contract, same no-keys boundary —
differing only in the AWS hosting surface (AgentCore Runtime vs API
Gateway + Lambda).

## Rationale

- **Single observable spend path:** keeping AgentCore a forwarding adapter
  preserves one model-spend path through Cloudflare AI Gateway; a
  Bedrock-invoking agent would split token accounting and add AWS model spend
  (token-economics, tco-zero).
- **R11 hard boundary:** the boundary rule is that no tier other than the
  Control_Plane holds model keys or invokes paid models. A forwarding adapter
  upholds it by construction; AWS holds no secrets to leak.
- **Min-viable-max-value:** the AgentCore artifact reuses the already-green
  forward-only adapter contract; no new reasoning path to build, secure, or pay
  for. Bedrock remains a deferred/optional future option per ADR-3, not a
  prerequisite.

## Property linkage (Property 1)

The approval-gate invariant (**Property 1** — paid actions execute only against a
verified, unexpired, unconsumed Approval_Token, and an Auth_Token never
substitutes for an Approval_Token) continues to hold at the `McpAgent` boundary
**regardless of whether the forwarded call originates from API Gateway/Lambda or
from the AgentCore Runtime**. Because the AgentCore artifact performs no paid
action of its own — it only forwards — every spend boundary is still gated on the
Cloudflare control plane. The decision adds no new spend boundary on AWS, so it
introduces no new place for Property 1 to be violated.

## Consequences / follow-ups

1. Section 13 AgentCore deployment tasks (container, IAM role, inbound-auth,
   observability, liveness) treat the runtime as a forwarding adapter; the IAM
   role grants **no** `bedrock:InvokeModel*` permissions and the container
   carries **no** model provider keys.
2. The secret-scan smoke tests (R11.1, R11.3, R11.5) already cover the AWS tier;
   they apply unchanged to the AgentCore artifact since it is keyless by design.
3. If Bedrock is ever brought onto the path, it is a new ADR and a re-audit of
   R11 — not a change permitted under this decision.

---

# AgentCore Runtime vs API Gateway + Lambda — replace or complement? (R11 audit, task 13.11)

**Status:** Decided (task 13.11 — audit finding)
**Date:** 2026-06-09
**Spec:** `.kiro/specs/knowgrph-acos-mcp-connector`
**Resolves:** Section 13 audit finding 13.11 (CDK Lambda adapter vs AgentCore Runtime topology) under R11/R12
**Cross-ref:** `design.md` › Open Decisions › Resolved Decisions ("AgentCore Runtime vs the API Gateway + Lambda adapter (R11, R12)"); builds on task 13.0 ("AgentCore Runtime artifact shape")

## Context

Task 13.0 pinned the AgentCore Runtime artifact as a **thin MCP-forwarding
adapter** (no model keys, no direct paid-model invocation — behaviorally
identical to the existing API Gateway + Lambda Agent_Api forwarder, differing
only in the AWS hosting surface). That leaves one topology question open: when
the AgentCore Runtime is introduced, does it **replace** the existing
API Gateway + Lambda + S3 tier (Section 5), or **complement** it?

The existing AWS tier (Section 5 / Section 11.2) is an API Gateway + Lambda + S3
deployment that exposes the product REST surface the Vercel frontend already
integrates with:

- `POST /auth/session` — mints the HS256 Auth_Token (R15).
- `POST /run` — auth → schema-validate → forward `knowgrph.video_remix.run` over
  MCP Streamable HTTP (R12.1–R12.4).
- `GET /runs/{id}` — entitlement-checked Run_Manifest read-back (R12.5, R12.6).
- `GET /health` — open liveness (R3.4, R15.6).
- S3 — durable artifact storage.

The AgentCore Runtime (Section 13.1) is an ARM64 container hosting a stateless
streamable-HTTP **MCP** server at `0.0.0.0:8000/mcp` (with `/ping` liveness),
deployed via `agentcore launch`, as the hackathon AWS-tier "deployable agent"
judging artifact.

## Decision

**AgentCore Runtime COMPLEMENTS the API Gateway + Lambda adapter — it does NOT
replace it.** The two AWS surfaces co-exist with distinct, non-overlapping
roles:

| Surface | Role | Protocol | Consumers |
|---|---|---|---|
| API Gateway + Lambda + S3 (Section 5/11.2) | Product **REST** surface: `POST /auth/session`, `POST /run`, `GET /runs/{id}`, `GET /health`, S3 artifacts | HTTPS/REST | Vercel frontend (`web/`), judges, `runtime:verify:deployed` |
| AgentCore Runtime (Section 13) | Durable **MCP tool surface** as the deployable-agent judging artifact (`tools/list`, `knowgrph.video_remix.run` + stage tools, `/ping`) | MCP Streamable HTTP | MCP clients (`agentcore invoke`), judges (Actions & Tool Use / Orchestration) |

Both are **keyless thin forwarders** to the Cloudflare control plane: each
forwards `knowgrph.video_remix.run` + the stage tools to the Cloudflare
`McpAgent` over MCP Streamable HTTP, holds no model keys, and invokes no paid
model directly (R11 preserved by construction, per task 13.0). The Cloudflare
control plane remains the single observable model-spend path and the single
approval-gate authority (Property 1 unchanged).

Concretely: the Vercel frontend continues to call the REST endpoints on
API Gateway + Lambda exactly as designed (Section 7). The AgentCore Runtime adds
a parallel, durable MCP entry point for MCP-native clients and for the judging
narrative — it is **additive**, not a migration of the REST surface.

## Rationale

- **min-viable-max-value:** the frontend (`web/`) already integrates with the
  REST surface (`NEXT_PUBLIC_AGENT_API_URL` → `POST /auth/session`, `POST /run`,
  `GET /runs/{id}`). Replacing that surface with a pure MCP endpoint would force
  a frontend rewrite (REST → MCP client) for zero user-facing benefit, and
  AgentCore Runtime does not natively expose the REST `auth/session` minting or
  the S3 artifact surface the product depends on. Complementing reuses the
  already-green REST tier and adds only the new MCP hosting surface.
- **tco-zero:** the API Gateway + Lambda + S3 tier is AWS free-tier with no
  always-on compute. Keeping it costs effectively nothing; AgentCore Runtime is
  introduced solely as the deployable-agent judging artifact. Neither tier
  duplicates model spend (both are keyless forwarders), so there is no double
  billing — the only model spend remains on Cloudflare AI Gateway.
- **R11 preserved (both paths):** because both surfaces are thin forwarders that
  hold no model keys and invoke no paid model, the spend-isolation boundary is
  identical regardless of which AWS surface a call enters through. Adding the
  AgentCore surface adds **no new spend boundary** on AWS (per task 13.0), so it
  cannot weaken R11 or Property 1.
- **Why not replace:** "replace" would (1) break the frontend's REST
  integration, (2) drop the REST `POST /auth/session` Auth_Token minting and the
  `GET /runs/{id}` read-back surface that judges and `runtime:verify:deployed` exercise,
  and (3) lose the S3 artifact storage role — all for no spend-isolation or
  cost gain, since the MCP surface is already keyless. Replace fails
  min-viable-max-value and adds rework risk; complement does not.

## Property linkage (Property 1)

Unchanged from task 13.0: the approval-gate invariant (**Property 1**) holds at
the Cloudflare `McpAgent` boundary regardless of whether a forwarded call
originates from the API Gateway/Lambda REST adapter **or** the AgentCore Runtime
MCP adapter. Both perform no paid action of their own; every spend boundary stays
gated on a verified, unexpired, unconsumed Approval_Token on the control plane.
The complement decision introduces no new AWS spend boundary, so it introduces
no new place for Property 1 to be violated.

## Consequences / follow-ups

1. **Section 11 deploy steps:** the existing API Gateway + Lambda + S3 deploy
   (task 11.2) and the AgentCore Runtime deploy (tasks 13.9, 13.10) are **both
   retained** and independently operator-gated by the `cloud-deploy`
   Approval_Gate. They are not mutually exclusive; an operator may deploy the
   REST tier alone (the frontend's hard dependency) and add the AgentCore tier
   when demonstrating the deployable-agent artifact.
2. **Task Dependency Graph:** the AgentCore section (13) remains an additive
   branch off the control-plane substrate (1), Agent-API (5), and Auth (6); it
   does not supersede the Section 5 → 11.2 deploy path.
3. **Deploy runbook:** documents both AWS surfaces — §2 (API Gateway + Lambda,
   the REST product surface the frontend calls) and §5 (AgentCore Runtime, the
   complementary durable MCP judging artifact) — with the explicit note that the
   AgentCore deploy is optional/additive and does not replace the REST tier.
4. **Demo_Pack `urls[]`:** carries **both** AWS endpoints — the REST Agent_Api
   `/health` (existing) and the AgentCore MCP endpoint (task 13.10) — so judges
   see the product REST surface and the deployable-agent MCP surface as distinct
   reachable artifacts.
5. If a future hardening pass wants a single AWS ingress, the REST surface could
   be fronted by the same container (REST routes + `/mcp` route) — but that is a
   new decision, not required by this one, and is out of MVP scope.

---

# AgentCore MCP server — container runtime / language (Node vs Python FastMCP) (R11 audit, task 13.12)

**Status:** Decided (task 13.12 — audit finding)
**Date:** 2026-06-09
**Spec:** `.kiro/specs/knowgrph-acos-mcp-connector`
**Resolves:** Section 13 audit finding 13.12 (container runtime/language for the AgentCore MCP server) under R11.1, R12.2, R14.1
**Cross-ref:** `design.md` › Open Decisions › Resolved Decisions ("AgentCore MCP server container runtime/language (Node vs Python FastMCP)"); builds on task 13.0 ("AgentCore Runtime artifact shape") and task 13.11 ("complement, not replace")

## Context

The `agentcore-samples` `02-hosting-MCP-server` tutorial implements its MCP
server in **Python FastMCP**. This project's entire connector — including the
Section 5 / task 12.1 MCP forwarder (`aws/agent-api/src/lib/mcp-forwarder.js`),
the Director runtime, and every harness — is **Node/TS**. Before the AgentCore
Runtime container is built (task 13.1) and deployed (tasks 13.9–13.10), the audit
must decide which runtime/language the AgentCore MCP server container uses:

- **(a)** build a **Node-based** MCP server container honoring the AgentCore MCP
  contract (`0.0.0.0:8000/mcp`, stateless streamable-HTTP, ARM64), reusing the
  existing Node/TS forwarder; or
- **(b)** **port the thin forwarder to Python FastMCP** per the sample.

Either path must hold **no model keys** and preserve R11 (the AgentCore artifact
is a thin forwarder per task 13.0, so it holds no secrets to leak regardless of
language).

## Decision

**Option (a): the AgentCore MCP server container is Node-based.** It honors the
AgentCore Runtime MCP contract — stateless streamable-HTTP MCP at
`0.0.0.0:8000/mcp` (with `/ping` GET liveness, task 13.7), ARM64 image — by
**reusing the existing Node/TS forwarder** (`aws/agent-api/src/lib/mcp-forwarder.js`)
rather than porting it to Python FastMCP. This is already realized in task 13.1:
`knowgrph/aws/agentcore/src/mcp-server.js` (the handler) + `server.js` (the
socket-binding entrypoint) + the ARM64 `Dockerfile` (`node:20-slim`), which
import and reuse the forwarder verbatim.

The sample's Python FastMCP choice is an **implementation detail of the tutorial,
not a contract requirement**. The AgentCore Runtime MCP contract is
language-agnostic: it specifies the transport (stateless streamable-HTTP), the
bind target (`0.0.0.0:8000/mcp`), the liveness route (`/ping`), and the ARM64
container/ECR/`agentcore launch` packaging — none of which mandate Python. A
Node server that serves that contract is equally valid.

## Rationale

- **reuse-over-rebuild / single SSOT:** the forwarder and the entire connector
  are Node/TS and already green. Reusing `mcp-forwarder.js` directly means the
  AgentCore MCP server and the API Gateway + Lambda REST adapter (task 13.11)
  share **one** forward-only transport implementation — one place to maintain
  the MCP Streamable HTTP client, the 2,000 ms deadline (R12.2 / Property 6), and
  the SSE/JSON-RPC parsing. A Python port would create a **parallel
  reimplementation** of that transport in a second language, with its own
  dependency tree, tests, and drift risk against the Node SSOT.
- **min-viable-max-value:** option (a) reuses an already-implemented, tested
  forwarder; option (b) is net-new code (FastMCP server, Python forward client,
  Python test suite, a Python toolchain in CI) for **zero** behavioral or
  judging benefit — the deployable-agent artifact is identical at the MCP
  contract boundary either way.
- **tco-zero:** no second-language toolchain to host, build, or pay for; the
  ARM64 `node:20-slim` image reuses the repo's existing Node 20 runtime.
- **R11 preserved by construction (either path):** the AgentCore artifact is a
  thin forwarder (task 13.0) — it holds **no model keys** in any config, env
  value, request, or response, and invokes **no paid model directly**; every
  spend-bearing call is forwarded to the Cloudflare control plane, the only tier
  that holds keys and calls paid models (R11.1, R11.2, R11.5). Language choice
  does not touch this boundary: Node and Python forwarders are both keyless. The
  fail-closed behavior (HTTP 501 when `MCP_ENDPOINT` is unset) ensures no
  accidental live/paid call even with no endpoint configured.
- **Contract honored regardless of sample:** `mcp-server.js` serves
  `0.0.0.0:8000/mcp` statelessly (every request handled independently, no session
  storage), advertises the Director + stage tools with both input and output
  schemas via `tools/list` (R14.1), and forwards within the shared 2,000 ms
  deadline (R12.2) — satisfying the AgentCore MCP contract without Python FastMCP.

## Property / requirement linkage

- **R11.1 / R11.5 (no model keys):** the Node container consumes only the
  control-plane endpoint (`MCP_ENDPOINT`); it reads, references, and requires no
  model provider key. Covered by the Section 9.3 secret-scan, which applies to
  the AWS tier unchanged (keyless by design).
- **R12.2 (forward within 2,000 ms):** the Node server reuses the forwarder's
  real-latency deadline measurement (Property 6) verbatim — no second-language
  reimplementation to re-verify.
- **R14.1 (tool surface with input + output schemas):** `TOOL_CATALOG` advertises
  the Director tool plus each stage tool, each with both schemas, over the Node
  `tools/list` handler.
- **Property 1 (approval-gate invariant):** unchanged — the Node forwarder
  performs no paid action and duplicates no gate logic; a control-plane "approval
  required" response is relayed unchanged, so no Approval_Gate can be bypassed on
  the AWS tier (gate authority stays on the Cloudflare Hitl_Gate_Service).

## Consequences / follow-ups

1. The AgentCore container (task 13.1), CLI config (`.bedrock_agentcore.yaml`,
   task 13.2), IAM role (task 13.3), inbound-auth (task 13.4), observability
   (13.5–13.6), liveness `/ping` (13.7), and local tests (13.8) all target the
   **Node** runtime; the `Dockerfile` is ARM64 `node:20-slim`.
2. The Python FastMCP path (option b) is **not pursued**. A clear seam is left in
   `mcp-server.js` documenting the alternative, but reviving it would be a new ADR
   and a re-audit of the R11 boundary — not required by this decision, since the
   Node path already satisfies the contract keylessly.
3. No model-key boundary changes either way; the secret-scan smoke tests
   (R11.1, R11.3, R11.5) cover the Node container unchanged.
