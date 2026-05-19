# Knowgrph MCP Integration (AI‑Native, Low‑TCO)

**Context (deployment chain)**  
Dev repo → Prod repo mirror → Cloudflare Pages at **`airvio.co/knowgrph`**.

**Requirements**
- **TCO**: keep fixed costs near‑zero; pay only when used; low operational burden.
- **Token performance/economics**: reduce tokens + latency, enforce budgets, measure costs.
- **FOSS + free-tier**: prioritize open tooling and free/cheap infra.
- **AI-native + MCP service integration**: MCP is the default “tool layer”.

---

## 1) What MCP is (for Knowgrph)

**Model Context Protocol (MCP)** is a standardized way for an LLM client/agent to call **tools** exposed by services (local or remote), using stable tool schemas.

For Knowgrph, MCP should be the integration boundary between:
- the **UI/orchestrator** (chat, workflows, parser pipelines), and
- external capabilities (GitHub/Stripe/etc.) plus **Knowgrph’s own domain tools** (parse/graph/export).

**Why MCP**
- **SSOT tool contracts**: one schema → many clients (UI, CLI, agents).
- **Vendor-neutral**: switch models/providers without rewriting integrations.
- **Composable**: workflows become tool graphs; easier to test and cache.
- **Lower ops** than bespoke API wiring (consistent auth/audit).

---

## 2) Recommended architecture (Cloudflare-first)

### Current implemented topology

The active deployment path is:

| Stage | Runtime | Responsibility |
|---|---|---|
| Dev | `/Users/huijoohwee/Documents/GitHub/knowgrph` | Source-owned MCP, crawler, storage, payment, docs, tests, and Worker configs |
| Prod mirror | `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph` | Synced static Pages artifact only |
| Cloudflare Pages | `airvio.co/knowgrph` | Static SPA, `llms.txt`, and asset delivery |
| Storage Worker | `airvio.co/api/storage/*` | D1 push/pull/export/doc-view plus read-only Source Files crawler indexes |
| Payment Worker | `airvio.co/api/payments/*` | Stripe Checkout Session creation, status reads, and webhook verification |

Current edge split: `knowgrph-storage` owns storage and crawler access; `knowgrph-payment` owns Stripe checkout and webhooks. The two Workers share the D1 database for checkout-session state, but keep route ownership and secrets separate.

MainPanel MCP surfaces two implemented readiness contracts:

- Stripe MCP readiness from the shared Stripe MCP SSOT: official remote MCP URL, local fallback launcher, non-secret config snippets, payment-capable tool labels, and confirmation policy.
- Crawler Access MCP readiness from the shared storage route contract: Source Files index routes, `llms.txt` routes, doc-view pattern, Worker metadata headers, Cloudflare Pay Per Crawl headers, and read-only guardrails.

Pay Per Crawl remains Cloudflare-owned. The app and Workers do not create `crawler-price`, `crawler-charged`, `crawler-error`, `crawler-exact-price`, or `crawler-max-price`; they only expose crawler-readable content after Cloudflare policy allows the request through.

As of 2026-05-19, `STRIPE_SECRET_KEY` is configured on `knowgrph-payment`; hosted checkout still requires server-owned price authority through `STRIPE_CHECKOUT_PRICE_ID` or `STRIPE_CHECKOUT_CURRENCY` + `STRIPE_CHECKOUT_UNIT_AMOUNT` + `STRIPE_CHECKOUT_PRODUCT_NAME`.

### 2.1 High-level topology

1. **Cloudflare Pages (static UI)**  
   Hosts the Knowgrph web app at `airvio.co/knowgrph`.

2. **Cloudflare Worker: `knowgrph-gateway` (API + MCP gateway)**  
   Single edge entrypoint that handles:
   - request auth + rate limits
   - MCP tool routing (namespace → server)
   - LLM calls (direct or via proxy)
   - caching and cost tracking

3. **MCP servers (plural, thin, versioned)**
   - **Knowgrph Core MCP**: domain tools (parse/graph/export/budget).
   - **Integration MCP**: third-party adapters (GitHub, Stripe, storage).
   - Deploy as:
     - **Option A (lowest ops)**: run small MCP servers inside Workers where feasible
     - **Option B (maximum compatibility)**: host MCP servers as tiny Node services elsewhere, fronted by the Worker gateway

4. **Data layer (minimal set)**
   - **KV**: exact cache, tool result cache, short-lived state.
   - **D1**: structured state + usage events (queryable analytics).
   - **R2**: large artifacts (exports, workspace snapshots, indexes).
   - **Vector store (optional)**: add only when needed for retrieval quality (caching usually wins first).

---

## 3) MCP servers to prioritize (Knowgrph-native)

### 3.1 “Knowgrph Core” MCP (highest leverage)
Expose these first because they are **product-differentiating** and enable AI-native workflows.

**A. Graph & schema**
- `graph.validate(schema, graph) -> report`
- `graph.diff(a, b) -> patchOps[]` (JSON Patch style)
- `schema.infer(dataset) -> schemaProposal`
- `schema.migrate(schema, fromVersion, toVersion) -> migratedSchema`

**B. Parsing / ingestion**
- `parse.universal(input, formatHint?) -> canonicalGraph` (JSON‑LD or equivalent)
- `parse.codebaseIndex(repoRef, options) -> indexArtifacts`
- `parse.webpage(url, options) -> extractedDoc`

**C. Rendering & export**
- `export.graph(format, options) -> artifactRef`
- `layout.compute(layoutConfig, graph) -> layoutArtifact`

**D. Budgeting & cost**
- `budget.getStatus(user|workspace) -> {limit, used, remaining}`
- `cost.estimate(text, model) -> {inputTokens, estCost}`
- `trace.get(traceId) -> timeline`

### 3.2 “Integration” MCP (service integration)
Start with a small number of integrations that unlock real flows:
- **GitHub MCP**: repo/file fetch + issues/PRs (for codebase indexing workflows).
- **Stripe MCP** (payment readiness): official remote MCP at `https://mcp.stripe.com` with OAuth preferred; local/server fallback uses `npx -y @stripe/mcp@latest` and a restricted key from the host environment.
- **Artifact store MCP**: abstract R2/D1/KV behind stable tools.
- **API-native browser MCP**: route discovery, login plus guarded cookie-import handoff, cached first-party API resolution, skill/session listing, feedback/verification, guarded route execution, and native browser capture/action fallback through `knowgrph.browser_api.run`.
- **Editor Workspace responsive verification**: treat mobile editor pane width, resize gutter, toolbar overflow, and Monaco focus checks as UI contract evidence from the root workspace defaults, not per-client remapping.

Keep integration MCP servers **thin**: translate external APIs into stable tool I/O; keep business logic in Knowgrph Core (or gateway).

### 3.3 Stripe MCP payment-readiness contract

MainPanel MCP owns Stripe MCP readiness; MainPanel Payments owns customer-facing checkout, entitlement, and reconciliation UX. This separation keeps payment setup agent-ready without mixing secret handling into the browser or duplicating checkout logic.

| Contract | Decision | Guard |
|---|---|---|
| Remote server | `https://mcp.stripe.com` | OAuth first |
| Registry entry | `https://github.com/mcp/com.stripe/mcp` | resolve from shared Stripe MCP constants |
| Local fallback | `npx -y @stripe/mcp@latest` | `STRIPE_SECRET_KEY` comes from local/server environment |
| Bearer fallback | restricted API key only | least-privilege permissions; never browser storage |
| Payment-mutating tools | create payment link/product/price/customer/invoice/refund | explicit human confirmation |
| Browser state | server key, URL, mode, timeout, non-secret config snippets | no `sk_*` or `rk_*` values |

---

## 4) Token performance & economics (playbook)

### 4.1 Highest ROI levers (in order)
1. **Stop resending large context**  
   Store workspace/context artifacts (R2/D1) and reference by ID.
2. **Exact caching** (always)  
   Cache key suggestion:
   - `(model, systemPromptHash, userPromptHash, toolStateHash, schemaVersion)`
3. **Tool-first workflows**  
   Prefer structured tool outputs over free-form LLM reasoning.
4. **Structured prompting & hard limits**
   - enforce JSON schema outputs
   - cap output tokens per endpoint
5. **Chunk + gate**
   - only summarize what is needed for the next action

### 4.2 Practical policies
- **Default max output tokens**: 400–1200 for interactive UI chat; higher only for exports.
- **Model tiering**:
  - cheap/fast model for routing/classification/extraction
  - higher-quality model only for synthesis and long-form transforms
- **Budget enforcement**:
  - per-user daily cap
  - per-workspace cap
  - per-workflow cap
- **Prompt compaction pipeline**:
  normalize tool output into minimal typed schemas before feeding back into an LLM.

### 4.3 Instrumentation (must-have)
Record per request:
- `input_tokens`, `output_tokens`, `model`, `latency_ms`
- `cache_hit` (and cache tier)
- `tool_calls[]` with `tool_latency_ms[]`
- `trace_id` (shared across gateway + MCP + LLM)

Store:
- logs (Workers logging) + optional structured events in **D1** table `llm_usage_events`.

---

## 5) TCO model (what actually costs money)

### 5.1 Cost categories (MECE)
1. **Compute**: Workers + any hosted MCP servers
2. **Storage**: KV/D1/R2 (+ vector store if used)
3. **LLM usage**: token spend (dominant variable cost)
4. **Observability**: logs/metrics/tracing retention
5. **Ops overhead**: time to maintain deploys/secrets/alerts

### 5.2 Recommended low-ops baseline
- **Cloudflare Pages + Workers** as the primary runtime.
- **KV + D1** for caches + structured state.
- **R2** for large artifacts (exports, snapshots, indexes).
- Add vector store only when retrieval value exceeds its ops+cost.

This keeps fixed cost ~0 while you validate usage. After that, token savings (caching, tiering, compaction) is the main TCO lever.

---

## 6) FOSS + free-tier friendly component choices

### 6.1 LLM routing / gateways (optional)
Goal: vendor neutrality + unified budgets/observability.

- **LiteLLM (FOSS)**: OpenAI-compatible proxy, routing, retries, fallbacks, cost tracking (best when you can run a small service).
- **Cloudflare AI Gateway**: not FOSS, but very low ops (central logging/caching/rate limiting) if acceptable.

Minimum-moving-parts default:
- call providers directly from the Worker now, add LiteLLM later when routing becomes necessary.

### 6.2 Self-hosted models (strict FOSS end-to-end)
- **Ollama** (local/dev)
- **llama.cpp** (portable)
- **vLLM** (higher throughput)

Trade-off: self-hosting raises ops costs; “FOSS + low TCO” usually means open tooling + hosted models until scale.

### 6.3 Vector stores / retrieval
- **pgvector** (simple if you already run Postgres)
- **Qdrant** (FOSS; strong default)
- **Chroma** (FOSS; easy dev)

---

## 7) Why Cloudflare fits MCP well

Workers are a strong fit for MCP gateways:
- low-latency edge routing
- caching (KV)
- request normalization + auth
- rate limiting / WAF
- global distribution by default

Standard call path:
Pages UI → Worker gateway → (LLM providers + MCP servers + KV/D1/R2).

---

## 8) Security & governance (integrations)

### 8.1 AuthN/AuthZ
- Use **service tokens** between gateway ↔ MCP servers.
- Use **user/session tokens** between UI ↔ gateway.
- Every tool call includes:
  - `workspaceId`, `userId`
  - `scopes[]` (capabilities)
  - `toolVersion`

### 8.2 Secrets
- Keep provider keys in Worker secrets.
- Never expose keys to the browser.
- For Stripe MCP, prefer OAuth on the remote server; if OAuth is unavailable, restricted API keys must live in a server secret store or local environment.
- MainPanel MCP may show `STRIPE_SECRET_KEY: ${STRIPE_RESTRICTED_KEY}` as a placeholder only; real Stripe keys are forbidden in docs, tests, fixtures, and browser storage.

### 8.3 Auditability
Log tool calls with:
- tool name + args hash (avoid storing secrets)
- principal (user/workspace)
- result size + status
- latency + trace id
- payment-mutating confirmation status for Stripe MCP calls.

---

## 9) Rollout plan (MVP → production)

### Phase 0 — SSOT tool contract
- Define versioned tool schemas for **Knowgrph Core**.
- Lock stable JSON I/O (strict, small, typed).

### Phase 1 — Gateway + 2–3 core tools
- Deploy Worker gateway.
- Implement:
  - `parse.universal`
  - `graph.validate`
  - `export.graph`
- Add exact caching + usage logging.

### Phase 2 — Integration MCP
- GitHub MCP for codebase workflows.
- Stripe MCP readiness before billing is enabled:
  - render remote/local config from shared constants
  - verify OAuth-preferred and restricted-key fallback guidance
  - require confirmation for payment-mutating tools
  - hand off checkout/entitlements to MainPanel Payments
- Add scopes + rate limiting.

### Phase 3 — Economics hardening
- model tiering
- prompt compaction
- semantic cache (optional)
- async workflows (Durable Objects / Queues) when needed

---

## 10) Decision matrix (quick picks)

### Lowest ops + fastest shipping
- Pages + Worker gateway
- direct provider calls from Worker
- KV cache + D1 usage logs
- minimal MCP set (Knowgrph Core)

### Maximum vendor neutrality
- Worker gateway + LiteLLM proxy (self-host)
- MCP servers as small Node services (self-host/cheap hosting)
- centralized routing + fallbacks + cost tracking

### Strict FOSS end-to-end
- self-host models (Ollama/vLLM) + FOSS vector store (Qdrant)
- Worker gateway optional (or self-host edge/API)
- expect higher ops effort

---

## Appendix A — Suggested minimal environment variables (names only)

**Gateway**
- `MODEL_PROVIDER_*` (provider keys via secrets)
- `MCP_SERVER_URLS` (namespace → base URL mapping)
- `CACHE_NAMESPACE`
- `BUDGET_LIMITS_*`

**MCP servers**
- `MCP_AUTH_SHARED_SECRET`
- `LOG_LEVEL`

**Stripe MCP host or backend only**
- `STRIPE_SECRET_KEY` (restricted key for bearer/local fallback only)

---

## Appendix B — “Good” acceptance criteria
- Tool calls are **deterministic** (same input → same output).
- Tool outputs are **small, typed, stable** (minimize downstream prompt size).
- Every request has a **trace id** and **cost record**.
- You can switch models/providers with **no tool contract changes**.
- Stripe MCP setup exposes official remote/local config while storing **zero Stripe secrets in the browser**.
- Payment-mutating Stripe MCP tools require explicit confirmation before execution.
