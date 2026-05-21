---
schema: kgc-computing-flow/v1
id: knowgrph-agent-ready-prd-tad-proposed
version: 1.1.0
status: proposed
created: 2026-05-21
updated: 2026-05-21
changelog:
  - "1.1.0: Enhanced E1-S3 Link Headers (subpath scoping), E2-S1 Markdown Negotiation (Hugo source-file strategy), E4-S5 WebMCP (promoted to Should; navigation-fix strategy); added ADR-5, ADR-6, ADR-7; updated TAD components and traceability matrix"
author: airvio / joohwee
domain: knowgrph
tags: [agent-ready, cloudflare, mcp, robots-txt, well-known, discoverability, prd, tad]
source_audit: isitagentready.com / Cloudflare Is Your Site Agent-Ready?
constraints:
  - solo-dev
  - tco-zero
  - foss-first
  - cloudflare-native
  - token-efficient
related:
  - prd-tad-guidelines.md
  - knowgrph-agent-ready-cloudflare-isitagentready.md
---

# Knowgrph Agent Ready — PRD + TAD (Proposed)

> **Scope**: Make the Knowgrph site fully compliant with emerging AI-agent discoverability and
> interoperability standards, as audited by [isitagentready.com](https://isitagentready.com).  
> **Deployment pipeline**: Dev (`/Users/huijoohwee/Documents/GitHub/knowgrph`) →
> Prod (`/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph`) →
> Cloudflare Pages (`airvio.co/knowgrph`).  
> **Critical context**: Knowgrph is served at a **subpath** (`/knowgrph`) under the `airvio.co` apex domain, not a subdomain. 
> This constrains header injection, `.well-known` placement, and
> Markdown negotiation strategy — all addressed in TAD.  
> **Constraints**: Solo-dev, TCO-zero, FOSS-first, Cloudflare-native stack, token-efficient implementation.

---

## Audit Baseline (isitagentready.com — 2026-05-21)

| Category | Item | Status |
|---|---|---|
| Discoverability | robots.txt | ❌ Not found |
| Discoverability | sitemap.xml | ❌ Not found |
| Discoverability | Link Headers (RFC 8288) | ❌ Not found |
| Content | Markdown Negotiation | ❌ Not supported |
| Bot Access Control | Web Bot Auth (JWKS) | ⚠️ HTML returned instead of JSON |
| Bot Access Control | AI Bot Rules in robots.txt | ❌ Blocked by missing robots.txt |
| Bot Access Control | Content Signals in robots.txt | ❌ Blocked by missing robots.txt |
| API / Auth / MCP | API Catalog (RFC 9727) | ⚠️ HTML returned instead of JSON |
| API / Auth / MCP | OAuth / OIDC Discovery | ❌ Not found |
| API / Auth / MCP | OAuth Protected Resource | ❌ Not found |
| API / Auth / MCP | MCP Server Card | ❌ Not found |
| API / Auth / MCP | Agent Skills Index | ⚠️ HTML returned instead of JSON |
| API / Auth / MCP | WebMCP | ⚠️ Could not check |
| Commerce (optional) | x402 Protocol | ℹ️ Not a commerce site |
| Commerce (optional) | MPP | ℹ️ Not a commerce site |
| Commerce (optional) | UCP | ℹ️ Not a commerce site |
| Commerce (optional) | ACP | ℹ️ Not a commerce site |

**Audit score: 0 / 13 active checks passing. 4 commerce checks deferred.**

---

# Part I — PRD

## Problem Statement

Knowgrph has zero AI-agent discoverability. 
AI crawlers (GPTBot, Claude-Web, Google-Extended), autonomous agents using MCP, and any system relying on standard HTTP discovery protocols cannot find, index, authenticate to, or tool-call Knowgrph's APIs. 
This blocks Knowgrph from being surfaced in AI-native workflows, referenced by LLM assistants, or integrated by third-party agent builders — all of which are increasingly the primary channels for developer and researcher discovery in 2026.

**Pain point → Impact → Opportunity**:  
Agent crawlers visit Knowgrph → find no robots.txt, no .well-known structure, 
no MCP endpoint → bounce without indexing → Knowgrph is invisible to AI-native search and agent pipelines.  
Opportunity: one focused Cloudflare Worker sprint delivers all critical endpoints, zero infra cost, and positions Knowgrph as an agent-first knowledge platform.

---

## Personas

### P1 — AI Crawler / Indexing Agent
**Job-to-be-done**: Discover crawl policy, fetch sitemap, index content in markdown, respect content usage signals.  
**Trigger**: Receives Knowgrph URL from a user query or link graph.  
**Frustration**: No robots.txt → treats site as uncrawlable or defaults to restrictive policy.

### P2 — Autonomous MCP Agent
**Job-to-be-done**: Discover MCP server card, authenticate via OAuth, enumerate skills, invoke Knowgrph tools on behalf of a user.  
**Trigger**: User delegates "explore this knowledge graph" to an AI agent.  
**Frustration**: No /.well-known/mcp/server-card.json, no OAuth metadata → agent cannot auto-configure integration.

### P3 — Developer / Agent Builder
**Job-to-be-done**: Integrate Knowgrph into an agentic pipeline using standard discovery protocols (RFC 9727 API Catalog, Agent Skills).  
**Trigger**: Building a research or knowledge-graph assistant and wants Knowgrph as a data source.  
**Frustration**: No API catalog, no structured skill manifest → must reverse-engineer API from docs or skip Knowgrph entirely.

### P4 — Solo Founder (Joohwee / airvio)
**Job-to-be-done**: Ship agent-readiness at zero additional infrastructure cost, maintain full control, and ensure every standard served is FOSS-compatible and auditable.  
**Trigger**: isitagentready.com audit returns 0/13; AI-native platform positioning requires passing.  
**Frustration**: Each missing standard requires a separate file or endpoint; no unified Cloudflare Worker template for the full .well-known stack exists.

---

## User Journeys

### Journey: AI Crawler — Discover & Index Knowgrph

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | Receives Knowgrph URL | External link / LLM context | None | — |
| Discover | Fetches `/robots.txt` | HTTP GET / | 404 → bounce | Publish robots.txt with AI crawler rules |
| Engage | Fetches `/sitemap.xml` | Sitemap reference in robots | Not linked → manual crawl | Reference sitemap from robots.txt |
| Engage | Requests content as Markdown | `Accept: text/markdown` | HTML returned → high token cost | Enable Markdown Negotiation |
| Complete | Indexes Knowgrph pages | Crawler index store | Pages not indexed | Clean markdown responses, low token overhead |
| Return | Re-crawls on schedule | Sitemap lastmod | Stale without lastmod | Auto-update sitemap on publish |

### Journey: MCP Agent — Discover & Integrate Knowgrph Tools

| Stage | Action | Touchpoint | Pain Point | Opportunity |
|---|---|---|---|---|
| Trigger | User delegates Knowgrph task | LLM agent orchestrator | None | — |
| Discover | Fetches `/.well-known/mcp/server-card.json` | HTTP GET | 404 → cannot auto-configure | Publish MCP Server Card |
| Discover | Fetches `/.well-known/oauth-protected-resource` | HTTP GET | 404 → no auth info | Publish OAuth Protected Resource metadata |
| Engage | Enumerates Agent Skills | `/.well-known/agent-skills/index.json` | 404 / HTML → no skills known | Publish Agent Skills index |
| Engage | Calls Knowgrph API with token | API endpoint | No API Catalog → agent guesses paths | Publish RFC 9727 API Catalog |
| Complete | Executes tool on behalf of user | MCP transport | N/A | Structured tool response |
| Return | Re-discovers on version bump | Server card version field | Version undetectable | Increment server card version on change |

---

## Epics & User Stories

### E1 — Discoverability

**E1-S1: robots.txt**  
**As a** AI crawler (P1) **I want** a standards-compliant `/robots.txt` with explicit per-agent rules 
**So that** I can determine crawl policy without defaulting to block.

**Acceptance Criteria**:
- **Given** any HTTP client, 
  **When** `GET /robots.txt` is requested, 
  **Then** a `200 text/plain` response is returned within 300 ms with `User-agent` directives for `*`, `GPTBot`, `Claude-Web`, `Google-Extended`, `OAI-SearchBot`, and a `Sitemap:` reference.
- **Given** the robots.txt is served, 
  **When** it is parsed by an RFC 9309-compliant parser,
  **Then** no syntax errors are reported.

> **`/goal` translation**: `curl -s https://knowgrph.io/robots.txt returns HTTP 200 text/plain
> with lines matching User-agent, Allow/Disallow, and Sitemap; wrangler deploy exits 0 and no
> other Worker route is modified`

**MoSCoW**: Must  
**Dependencies**: Cloudflare Pages or Worker route for `/robots.txt`  
**Out of Scope**: Dynamic per-user crawl policies

---

**E1-S2: sitemap.xml**  
**As a** AI crawler (P1) 
**I want** a valid `/sitemap.xml` 
**So that** I can enumerate all canonical Knowgrph URLs without brute-force crawling.

**Acceptance Criteria**:
- **Given** a request `GET /sitemap.xml`, 
  **When** served, 
  **Then** returns `200 application/xml` with `<urlset>` containing at minimum the homepage and all published node pages, each with `<loc>` and `<lastmod>`.
- **Given** robots.txt is published, 
  **When** parsed, 
  **Then** contains `Sitemap: https://knowgrph.io/sitemap.xml`.

> **`/goal` translation**: 
> `curl -s https://knowgrph.io/sitemap.xml returns HTTP 200 XML with at least one <url> element containing <loc> and <lastmod>; 
> robots.txt Sitemap: line present`

**MoSCoW**: Must  
**Dependencies**: E1-S1, site page inventory  
**Out of Scope**: Sitemap index files (multi-sitemap), image/video sitemaps

---

**E1-S3: Link Headers (RFC 8288)**  
**As a** MCP agent or API client (P2, P3) 
**I want** `Link` response headers on the Knowgrph homepage 
**So that** I can auto-discover the API catalog, MCP endpoint, and documentation without scraping HTML.

**Deployment context**: Knowgrph is at `airvio.co/knowgrph` (subpath, not subdomain).
`.well-known` endpoints live at `airvio.co/.well-known/*` (apex). 
Link header values must reference apex-relative paths. 
The Cloudflare Worker for `airvio.co` must intercept `GET /knowgrph` (and `GET /knowgrph/`) responses to inject headers — not a Pages config.

**Acceptance Criteria**:
- **Given** `GET https://airvio.co/knowgrph`, **When** response headers are inspected,
  **Then** the response includes at minimum:
  - `Link: </.well-known/api-catalog>; rel="api-catalog"`
  - `Link: </knowgrph/openapi.json>; rel="service-desc"; type="application/json"`
  - `Link: </.well-known/mcp/server-card.json>; rel="mcp-server-card"`
- **Given** the headers are injected by Worker, 
  **When** the homepage also returns HTML to a browser, 
  **Then** HTML content is unmodified (headers-only augmentation, no body change).
- **Given** `airvio.co` serves other subpaths (not `/knowgrph`), **When** those are fetched,
  **Then** Knowgrph-specific Link headers are absent (no header bleed to unrelated paths).

> **`/goal` translation**: 
> `curl -sI https://airvio.co/knowgrph returns lines matching
> Link:.*rel="api-catalog" and Link:.*rel="service-desc"; 
> curl -sI https://airvio.co/ does NOT contain rel="api-catalog"`

**MoSCoW**: Should  
**Dependencies**: E4-S1 (API Catalog must exist at `/.well-known/api-catalog`); `airvio.co` Worker route must include `/knowgrph*` pattern  
**Out of Scope**: Link headers on all Knowgrph subpages (homepage only, phase 1); other `airvio.co` subpath Link headers

---

### E2 — Content Negotiation

**E2-S1: Markdown for Agents**  
**As a** AI crawler or agent (P1, P2) 
**I want** Knowgrph pages to return Markdown when I send `Accept: text/markdown` 
**So that** I receive compact, token-efficient content without HTML parsing overhead or LLM token waste.

**Deployment context**: The dev repo at `/Users/huijoohwee/Documents/GitHub/knowgrph` is a Hugo site. 
Source content lives as `.md` files in `content/`. 
The prod path `/Users/huijoohwee/Documents/GitHub/huijoohwee/content/knowgrph` is the Hugo content directory committed into the `huijoohwee` publishing repo. 
Cloudflare Pages builds and serves the HTML output at `airvio.co/knowgrph`.

**Strategy — Hugo Source-File Passthrough (preferred over on-the-fly HTML stripping)**:
Hugo content files at `content/knowgrph/*.md` are already canonical Markdown. 
The Worker intercepts `Accept: text/markdown` requests, maps the URL path to the corresponding `.md` source file served from a parallel static route, 
and returns it directly — zero HTML-to-Markdown conversion, zero token waste from rendered decorators (nav, footer, scripts).

**Acceptance Criteria**:
- **Given** `GET https://airvio.co/knowgrph` with `Accept: text/markdown`, **When** served,
  **Then** returns `200 text/markdown` with the raw Hugo `content/knowgrph/_index.md` body
  (front matter stripped or preserved as YAML comment block per agent convention).
- **Given** `GET https://airvio.co/knowgrph/[slug]` with `Accept: text/markdown`, 
  **When** served, 
  **Then** returns `200 text/markdown` with the corresponding `content/knowgrph/[slug].md` body.
- **Given** `x-markdown-tokens` can be computed at serve time, 
  **When** Markdown response is sent, 
  **Then** `x-markdown-tokens: N` header is included (approximate token count).
- **Given** any request without `Accept: text/markdown`, 
  **When** served, 
  **Then** returns standard HTML — no regression to existing site.
- **Given** a requested slug has no corresponding `.md` source, 
  **When** served, 
  **Then**
  Worker falls back to HTML response with `Content-Type: text/html` (no 404 on missing Markdown source).

> **`/goal` translation**: `curl -sH "Accept: text/markdown" https://airvio.co/knowgrph
> returns Content-Type: text/markdown and body does NOT contain <html; curl -s
> https://airvio.co/knowgrph returns Content-Type: text/html with no diff to pre-deploy`

**MoSCoW**: Must  
**Dependencies**: Hugo `.md` source files exposed at a static route under
`/knowgrph-src/[slug].md` (committed to Pages `/public/knowgrph-src/`) OR served via
Cloudflare R2 bucket populated at build time; Worker route `airvio.co/knowgrph*` active  
**Out of Scope**: On-the-fly HTML-to-Markdown conversion (HTMLRewriter approach is fallback only); front matter inclusion policy (strip for phase 1); non-Knowgrph subpaths on `airvio.co`

---

### E3 — Bot Access Control

**E3-S1: AI Bot Rules in robots.txt**  
**As a** AI crawler (P1) 
**I want** explicit `User-agent` entries for AI bots with clear allow/disallow 
**So that** I know exactly which paths I may index.

**Acceptance Criteria**:
- **Given** robots.txt, 
  **When** parsed, 
  **Then** contains named entries for `GPTBot`, `Claude-Web`, `Google-Extended`, `OAI-SearchBot` each with at least one `Allow` or `Disallow` directive.

> **`/goal` translation**: `grep -E "^User-agent: (GPTBot|Claude-Web|Google-Extended|OAI-SearchBot)"
> output of curl /robots.txt returns 4 matches`

**MoSCoW**: Must (bundled with E1-S1 — same file)  
**Dependencies**: E1-S1  
**Out of Scope**: Automated per-bot policy management UI

---

**E3-S2: Content Signals**  
**As a** AI training pipeline operator 
**I want** `Content-Signal` directives in robots.txt
**So that** I respect Knowgrph's explicit preferences on training and search use.

**Acceptance Criteria**:
- **Given** robots.txt, 
  **When** parsed by a Content Signals-aware consumer, 
  **Then** at least `Content-Signal: ai-train=no, search=yes, ai-input=yes` is present.

> **`/goal` translation**: `grep "Content-Signal:" output of curl /robots.txt returns one line
> with ai-train, search, and ai-input values`

**MoSCoW**: Should  
**Dependencies**: E1-S1  
**Out of Scope**: Granular per-path content signals (global policy only, phase 1)

---

**E3-S3: Web Bot Auth (JWKS)**  
**As a** receiving site **I want** Knowgrph to publish a JWKS at
`/.well-known/http-message-signatures-directory` **So that** when Knowgrph's crawler/agent
makes outbound requests, the receiving site can verify the signature.

**Acceptance Criteria**:
- **Given** `GET /.well-known/http-message-signatures-directory`, 
  **When** requested, 
  **Then** returns `200 application/json` with a valid JWKS structure (`{"keys": [...]}`).

> **`/goal` translation**: `curl /.well-known/http-message-signatures-directory returns HTTP 200
> Content-Type application/json and body contains "keys" array`

**MoSCoW**: Could (informational — Knowgrph is primarily a server, not a bot)  
**Dependencies**: JWKS key generation (one-time)  
**Out of Scope**: Request-signing middleware for outbound Knowgrph agent calls (phase 2)

---

### E4 — API, Auth, MCP & Skill Discovery

**E4-S1: API Catalog (RFC 9727)**  
**As a** developer / agent builder (P3) 
**I want** `/.well-known/api-catalog` returning RFC 9727-compliant JSON 
**So that** I can auto-discover Knowgrph's API endpoints, specs, and status page without reading docs.

**Acceptance Criteria**:
- **Given** `GET /.well-known/api-catalog`, 
  **When** requested, 
  **Then** returns `200 application/linkset+json` with a `linkset` array; each entry has `anchor`, and link relations for `service-desc` (OpenAPI spec URL) and `service-doc` (docs URL).
- **Given** `service-desc` URL, 
  **When** fetched, 
  **Then** returns a valid OpenAPI 3.x document.

> **`/goal` translation**: `curl /.well-known/api-catalog returns HTTP 200 application/linkset+json
> with linkset[0].anchor present and service-desc URL reachable returning 200`

**MoSCoW**: Should  
**Dependencies**: OpenAPI spec for Knowgrph API (may be stub v0.1)  
**Out of Scope**: Auto-generated API catalog from code (manual JSON, phase 1)

---

**E4-S2: OAuth Protected Resource (RFC 9728)**  
**As a** MCP agent (P2) 
**I want** `/.well-known/oauth-protected-resource` 
**So that** I can discover which OAuth/OIDC servers issue valid tokens for Knowgrph APIs.

**Acceptance Criteria**:
- **Given** `GET /.well-known/oauth-protected-resource`, 
  **When** requested, 
  **Then** returns `200 application/json` with `resource`, `authorization_servers`, and `scopes_supported` fields.

> **`/goal` translation**: `curl /.well-known/oauth-protected-resource returns HTTP 200 JSON
> with keys resource, authorization_servers (non-empty array), and scopes_supported`

**MoSCoW**: Should  
**Dependencies**: OAuth/OIDC provider decision (Cloudflare Access or external IdP)  
**Out of Scope**: Full OAuth server implementation (reference metadata only, phase 1)

---

**E4-S3: MCP Server Card**  
**As a** MCP agent (P2) 
**I want** `/.well-known/mcp/server-card.json` 
**So that** I can auto-configure a connection to Knowgrph's MCP server without manual setup.

**Acceptance Criteria**:
- **Given** `GET /.well-known/mcp/server-card.json`, 
  **When** requested, 
  **Then** returns
  `200 application/json` with `serverInfo` (name, version), `transport` endpoint URL, and
  `capabilities` listing available tools.
- **Given** the transport endpoint is reachable, 
  **When** an MCP `initialize` request is sent,
  **Then** a valid `InitializeResult` is returned.

> **`/goal` translation**: `curl /.well-known/mcp/server-card.json returns HTTP 200 JSON with
> serverInfo.name, serverInfo.version, and transport fields present`

**MoSCoW**: Should  
**Dependencies**: Knowgrph MCP server implementation (may be stub SSE endpoint, phase 1)  
**Out of Scope**: Full tool implementation in MCP server (phase 2); browser-side WebMCP

---

**E4-S4: Agent Skills Index**  
**As a** agent builder (P3) 
**I want** `/.well-known/agent-skills/index.json` 
**So that** I can enumerate all Knowgrph agent skills with their schemas and digests without manual discovery.

**Acceptance Criteria**:
- **Given** `GET /.well-known/agent-skills/index.json`, 
  **When** requested, 
  **Then** returns `200 application/json` with `$schema`, and a `skills` array where each entry has `name`, `type`, `description`, `url`, and `sha256`.
- **Given** each skill `url`, 
  **When** fetched, 
  **Then** returns the corresponding SKILL.md or JSON schema.

> **`/goal` translation**: `curl /.well-known/agent-skills/index.json returns HTTP 200 JSON
> with skills array length >= 1 and each item has name, type, url, sha256 fields`

**MoSCoW**: Should  
**Dependencies**: At least one Agent Skill defined for Knowgrph  
**Out of Scope**: Automated skill digest computation on deploy (manual SHA-256, phase 1)

---

**E4-S5: WebMCP**  
**As a** browser-based AI agent (P2) 
**I want** Knowgrph to expose tools via `navigator.modelContext.provideContext()` 
**So that** in-browser agents (Chrome with WebMCP EPP) can discover and invoke Knowgrph actions — graph search, node lookup — without a separate API handshake.

**Audit issue analysis**: The isitagentready.com scan returned _"Execution context was destroyed, most likely because of a navigation."_ 
This is a browser-side race condition: 
the audit checker runs `navigator.modelContext` evaluation, the page navigates or redirects before the script executes, and the context is torn down. 
The fix is not complex — it requires calling
`provideContext()` at the earliest possible lifecycle point (`<head>` inline script or
`DOMContentLoaded` with `capture: true`) before any navigation or redirect fires.

**Deployment context**: Hugo generates static HTML. 
The WebMCP init script is injected via Hugo's `layouts/partials/head.html` (or `baseof.html`) as an inline `<script>` in `<head>`, scoped to the `knowgrph` section only. 
No Worker involvement needed; the fix is a Hugo template change committed in dev and propagated to prod on next build.

**Acceptance Criteria**:
- **Given** Chrome with WebMCP EPP support loads `https://airvio.co/knowgrph`, 
  **When** `DOMContentLoaded` fires, 
  **Then** `navigator.modelContext` is defined and `navigator.modelContext.tools` contains at least one tool (`search_graph`).
- **Given** the WebMCP init script runs, 
  **When** `navigator.modelContext.provideContext()` is called, 
  **Then** no console errors are thrown and `navigator.modelContext.tools.length >= 1`.
- **Given** a non-Knowgrph page on `airvio.co` is loaded, 
  **When** inspected, 
  **Then** `navigator.modelContext` is either undefined or contains no Knowgrph-specific tools (scoped injection — no bleed to other sections).
- **Given** the audit checker re-runs, **When** `navigator.modelContext` is evaluated,
  **Then** the "execution context destroyed" error does not occur (script fires before
  any navigation).

> **`/goal` translation**: `window.navigator.modelContext?.tools?.length >= 1 evaluated in
> Chrome DevTools console on airvio.co/knowgrph returns true; no Uncaught errors in console;
> Hugo build exits 0 and layouts/partials/head-knowgrph.html contains provideContext call`

**MoSCoW**: **Should** _(promoted from Could — fix is a Hugo partial change, ~20 lines,
zero infra cost; audit failure was a lifecycle race, not a missing feature)_  
**Dependencies**: Chrome WebMCP EPP (`navigator.modelContext` available); Hugo partial
injection scoped to `knowgrph` section (`layouts/knowgrph/baseof.html` or section-specific
partial); at least one tool schema defined (`search_graph`)  
**Out of Scope**: Firefox/Safari WebMCP support; full tool implementation beyond stub
`search_graph`; non-browser agent contexts (MCP SSE covers those via E4-S3)

---

### E5 — Commerce (Deferred)

**E5: x402 / MPP / UCP / ACP**  
**Won't** implement in this release. Knowgrph is not a commerce site. Commerce protocols
(x402, MPP, UCP, ACP) provide no user value at current product stage.  
**Revisit condition**: When Knowgrph introduces paid API tiers or knowledge subscriptions.

---

## Success Metrics

| Metric | Baseline | Target | Timeline |
|---|---|---|---|
| isitagentready.com score | 0 / 13 | 11 / 13 (E5 deferred, E3-S3 Could) | Sprint 1 (2 weeks) |
| robots.txt HTTP 200 | ❌ | ✅ | Week 1 |
| sitemap.xml HTTP 200 | ❌ | ✅ | Week 1 |
| Markdown negotiation pass | ❌ | ✅ | Week 1 |
| MCP Server Card HTTP 200 | ❌ | ✅ | Week 2 |
| Agent Skills index HTTP 200 | ❌ | ✅ | Week 2 |
| API Catalog HTTP 200 | ❌ | ✅ | Week 2 |
| Cloudflare Worker deploy cost | $0 (free tier) | $0 | Ongoing |
| Token cost per agent page fetch | ~4–8k HTML tokens | ~800–1.5k Markdown tokens | Week 1 |

---

## Scope Boundaries

**In scope**: All 13 active audit checks from isitagentready.com; Cloudflare-native delivery only.  
**Out of scope**: Commerce protocols (E5); non-Cloudflare infrastructure; OAuth server
implementation; full MCP tool suite; sitemap image/video extensions; per-page content signals.

---

## Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| OQ-1 | Which OAuth/OIDC provider will Knowgrph use? (Cloudflare Access vs external IdP) | Joohwee | Decide before E4-S2 |
| OQ-2 | Does Knowgrph have an active MCP server endpoint, or is phase 1 a stub SSE? | Joohwee | Stub acceptable for Server Card; real SSE for E4-S3 full pass |
| OQ-3 | Will sitemap be statically generated at build time or dynamically from KGC node store? | Joohwee | Static for phase 1; dynamic Cloudflare Worker for phase 2 |
| OQ-4 | Content Signals policy: allow `ai-input=yes`? | Joohwee | Default yes (benefits Knowgrph's positioning); confirm before E3-S2 |
| OQ-5 | Does `airvio.co` already have a Cloudflare Worker on the zone? If so, Worker routes must be additive, not replacement. | Joohwee | Check CF dashboard before TAD-CF-WORKER deploy |
| OQ-6 | Hugo site structure: does `layouts/knowgrph/baseof.html` exist, or is Knowgrph using a shared baseof? | Joohwee | Determine before TAD-CF-WEBMCP implementation; if shared, use a section-conditional partial |
| OQ-7 | CI: does the `huijoohwee` publishing repo build with Hugo CI, or is `public/knowgrph-src/` committed manually? | Joohwee | Needed to decide placement of `export-md-src.sh` step |

---

# Part II — TAD

## Architecture Overview

**From agent HTTP request to structured discovery response**:  
Cloudflare Edge → Worker (well-known router) → static JSON / dynamic response → agent.

All endpoints are served from a single Cloudflare Worker (`knowgrph-agent-worker`) with route-based dispatch. 
Static seed files (robots.txt, sitemap.xml, JSON manifests) are committed to the repository and served via Cloudflare Pages with Worker augmentation for dynamic headers and markdown negotiation.

**TCO**: Cloudflare Workers free tier (100k requests/day), Pages free tier (500 builds/month), R2 zero egress. Total additional monthly cost: **$0**.

---

## Journey → System Mapping

| Journey Stage | Workflow | Data Flow | Component |
|---|---|---|---|
| AI Crawler Discover | Crawl Policy Resolution | robots.txt Serve | TAD-CF-STATIC |
| AI Crawler Engage | Content Fetch | Markdown Negotiation | TAD-CF-PAGES |
| MCP Agent Discover | MCP Config Resolution | Server Card Serve | TAD-CF-WORKER |
| MCP Agent Discover | Auth Discovery | OAuth Metadata Serve | TAD-CF-WORKER |
| MCP Agent Engage | Skill Enumeration | Agent Skills Index Serve | TAD-CF-WORKER |
| Dev / Agent Builder | API Discovery | API Catalog Serve | TAD-CF-WORKER |
| Homepage Request | Link Header Injection | HTTP Header Augmentation | TAD-CF-WORKER |

---

## Component Specifications

### TAD-CF-STATIC
**Responsibility**: Serves static files (`/robots.txt`, `/sitemap.xml`) from Cloudflare Pages `/public` directory as committed assets.  
**Interfaces**: `GET /robots.txt → 200 text/plain`, `GET /sitemap.xml → 200 application/xml`  
**Dependencies**: Cloudflare Pages (free tier), Git-committed static files  
**Configuration**: Files committed to `/public/robots.txt` and `/public/sitemap.xml`; updated manually or via CI on content change.  
**`/goal` Conditions**:  
- `curl -s -o /dev/null -w "%{http_code}" https://knowgrph.io/robots.txt returns 200`  
- `grep -c "User-agent:" output of /robots.txt >= 5` (wildcard + 4 AI bots)  
- `grep "Sitemap:" /robots.txt returns one match pointing to /sitemap.xml`  
**Traces**: PRD-E1-S1, PRD-E1-S2, PRD-E3-S1, PRD-E3-S2

---

### TAD-CF-PAGES
**Responsibility**: Serves Knowgrph page content with content-negotiation: returns `text/markdown` of the Hugo source `.md` file when `Accept: text/markdown` is present; returns `text/html` (CF Pages build output) otherwise.

**Strategy — Hugo Source-File Passthrough**:
At Hugo build time, a CI step copies all `content/knowgrph/*.md` files into `public/knowgrph-src/` (stripping front matter). 
Cloudflare Pages serves these as static assets. The Worker intercepts `Accept: text/markdown` on `/knowgrph*` paths, derives the
source path (`/knowgrph/some-slug` → `/knowgrph-src/some-slug.md`), fetches it from Pages,
and returns it with `Content-Type: text/markdown`. This avoids HTML-to-Markdown conversion
entirely — the source IS the canonical Markdown.

**Fallback**: If `/knowgrph-src/[slug].md` returns 404 (page has no source, e.g. auto-generated
taxonomy pages), Worker falls back to HTML response unchanged.

**Interfaces**:
- `GET /knowgrph[/slug]` with `Accept: text/markdown` → `200 text/markdown` (source `.md`)
- `GET /knowgrph[/slug]` default → `200 text/html` (CF Pages build output, unmodified)
- Optional: `x-markdown-tokens: N` header computed as `Math.ceil(body.length / 4)` (tiktoken approximation, zero-dep)

**Dependencies**:
- Hugo build step: `scripts/export-md-src.sh` copies `content/knowgrph/*.md` → `public/knowgrph-src/`
- Cloudflare Pages serves `/knowgrph-src/*` as static assets
- TAD-CF-WORKER intercepts `Accept: text/markdown` on `/knowgrph*`
- No external npm deps; Worker uses native `fetch()` to self-request source files

**Configuration**:
- `wrangler.toml` route: `airvio.co/knowgrph*` → Worker
- Worker env var: `PAGES_ORIGIN = "https://airvio.co"` (self-fetch source files)
- Hugo `config.toml`: no changes needed (source export is a CI step, not a Hugo feature)

**`/goal` Conditions**:
- `curl -sH "Accept: text/markdown" https://airvio.co/knowgrph returns Content-Type: text/markdown and body first line starts with #`
- `curl -s https://airvio.co/knowgrph returns Content-Type: text/html with no regression`
- `ls public/knowgrph-src/*.md | wc -l >= 1` after Hugo build step
- `Worker handler for text/markdown does not contain HTMLRewriter import` (no HTML stripping)

**Traces**: PRD-E2-S1

---

### TAD-CF-WORKER
**Responsibility**: Serves all dynamic `.well-known/*` endpoints, injects `Link` headers on Knowgrph homepage responses, and dispatches `Accept: text/markdown` requests to source files — all from a single Cloudflare Worker on `airvio.co` with route-based dispatch.

**Subpath constraint**: Knowgrph lives at `airvio.co/knowgrph`. 
The Worker must be registered on the `airvio.co` zone (not a separate domain). Route patterns:
- `airvio.co/.well-known/*` → all `.well-known` endpoint handlers
- `airvio.co/knowgrph` → Link header injection + Markdown negotiation passthrough
- `airvio.co/knowgrph/*` → Markdown negotiation passthrough

**Link header injection detail**: 
Worker intercepts `GET /knowgrph` responses from CF Pages, adds `Link` headers, and returns the augmented response. 
Headers use apex-relative paths (`/.well-known/api-catalog`, not `/knowgrph/.well-known/...`) per RFC 8288 origin-relative convention. 
Link headers must NOT be injected on non-`/knowgrph` routes.

**Interfaces**:

| Route | Response Type | RFC / Spec |
|---|---|---|
| `GET /.well-known/api-catalog` | `application/linkset+json` | RFC 9727 |
| `GET /.well-known/oauth-protected-resource` | `application/json` | RFC 9728 |
| `GET /.well-known/mcp/server-card.json` | `application/json` | SEP-1649 |
| `GET /.well-known/agent-skills/index.json` | `application/json` | Agent Skills Discovery v0.2.0 |
| `GET /.well-known/http-message-signatures-directory` | `application/json` | Web Bot Auth |
| `GET /knowgrph` (passthrough + header inject) | Link headers added | RFC 8288 |
| `GET /knowgrph*` with `Accept: text/markdown` | `200 text/markdown` source file | Markdown for Agents |

**Link headers injected on `GET /knowgrph`**:
```
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </knowgrph/openapi.json>; rel="service-desc"; type="application/json"
Link: </.well-known/mcp/server-card.json>; rel="mcp-server-card"
Link: </knowgrph>; rel="canonical"
```

**Dependencies**: Cloudflare Workers (free tier); JSON seed files in `worker/data/`;
Wrangler CLI; `airvio.co` zone access in CF dashboard to register Worker route.  
**Configuration**: `wrangler.toml` routes scoped to `airvio.co/.well-known/*` AND `airvio.co/knowgrph*`; JSON seed files externalized.

**`/goal` Conditions**:
- `wrangler deploy exits 0`
- `curl -sI https://airvio.co/knowgrph contains Link:.*rel="api-catalog"`
- `curl -sI https://airvio.co/knowgrph contains Link:.*rel="service-desc"`
- `curl -sI https://airvio.co/ does NOT contain rel="api-catalog"` (no bleed)
- `curl -s https://airvio.co/.well-known/api-catalog returns HTTP 200 application/linkset+json`
- `curl -s https://airvio.co/.well-known/mcp/server-card.json returns HTTP 200 JSON with serverInfo.name`
- `curl -s https://airvio.co/.well-known/agent-skills/index.json returns HTTP 200 JSON with skills array`

**Traces**: PRD-E1-S3, PRD-E4-S1, PRD-E4-S2, PRD-E4-S3, PRD-E4-S4, PRD-E3-S3

---

### TAD-CF-BOTAUTH
**Responsibility**: Publishes a JWKS (JSON Web Key Set) at `/.well-known/http-message-signatures-directory` to allow receiving sites to verify signed outbound requests made by Knowgrph agents.  
**Interfaces**: `GET /.well-known/http-message-signatures-directory → 200 application/json` with `{"keys": [<JWK>]}`  
**Dependencies**: TAD-CF-WORKER (serves endpoint); one-time key generation via `node:crypto` or `openssl`; JWK committed to `worker/data/jwks.json`.  
**Configuration**: JWK stored as Worker environment secret or committed JSON (public key only).  
**`/goal` Conditions**:  
- `curl /.well-known/http-message-signatures-directory returns HTTP 200 JSON with keys array length >= 1`  
**Traces**: PRD-E3-S3

---

### TAD-CF-WEBMCP
**Responsibility**: Injects WebMCP tool definitions into Knowgrph pages via a Hugo partial `<head>` inline script, calling `navigator.modelContext.provideContext()` before any page navigation fires. 
Scoped exclusively to the `knowgrph` Hugo section.

**Root cause of audit failure**: The isitagentready.com checker evaluates `navigator.modelContext` via headless Chrome. 
The "execution context destroyed" error indicates the page triggered a navigation or redirect before the script ran — not that the API was absent.
Fix: inject `provideContext()` as the **first** `<script>` in `<head>`, synchronously, before any meta-refresh, JS router redirect, or deferred script. 
Hugo section-scoped partials make this a one-template change.

**Hugo injection pattern**:
- File: `layouts/knowgrph/baseof.html` (or `layouts/partials/knowgrph-webmcp.html` included from `baseof.html`)
- Script tag: inline `<script>` in `<head>`, before any other script, no `defer`/`async`
- Guard: `if (typeof navigator.modelContext !== 'undefined')` — no error on non-EPP Chrome
- Scope guard: script only present on pages with Hugo section `knowgrph` (template scoping, not runtime URL check)

**Tool stub — `search_graph`**:
```javascript
if (typeof navigator.modelContext !== 'undefined') {
  navigator.modelContext.provideContext({
    tools: [{
      name: "search_graph",
      description: "Search Knowgrph knowledge graph nodes by query. Returns matching node titles, types, and URLs.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string" },
          limit: { type: "number", description: "Max results (default 10)" }
        },
        required: ["query"]
      },
      execute: async ({ query, limit = 10 }) => {
        const res = await fetch(`/knowgrph/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        return res.ok ? res.json() : { error: res.statusText };
      }
    }]
  });
}
```

**Interfaces**: Browser JS API — `navigator.modelContext.tools` array available after `DOMContentLoaded`; `execute` calls `GET /knowgrph/api/search?q=...`

**Dependencies**:
- Hugo section `layouts/knowgrph/baseof.html` exists (or can be created)
- Chrome WebMCP EPP (`navigator.modelContext` defined); gracefully no-ops on other browsers
- `GET /knowgrph/api/search` endpoint — stub returning `[]` acceptable for phase 1 (WebMCP registration succeeds even with empty results; full search wired in phase 2)

**Configuration**:
- Hugo: `config.toml` no changes; template change only
- Script: inline in `<head>`, no external file, no Worker involvement, no npm dep
- Phase 2: replace stub `fetch` with real KGC search API call

**`/goal` Conditions**:
- `grep -l "provideContext" layouts/knowgrph/baseof.html exits 0` (template contains call)
- `hugo build exits 0 and public/knowgrph/index.html contains provideContext`
- `Chrome DevTools console on airvio.co/knowgrph: navigator.modelContext?.tools?.length >= 1 returns true`
- `Chrome DevTools console: no Uncaught TypeError on page load`
- `curl -s https://airvio.co/ | grep -c provideContext returns 0` (no bleed to apex)

**Traces**: PRD-E4-S5

---

## Workflows

### Workflow: Agent Crawl Policy Resolution

**Trigger**: AI crawler sends `GET /robots.txt`  
**Actors**: AI Crawler (P1), Cloudflare Pages (TAD-CF-STATIC)

**Happy Path**:
1. Crawler sends `GET https://knowgrph.io/robots.txt`
2. Cloudflare Pages serves `/public/robots.txt` → `200 text/plain`
3. Crawler parses User-agent directives, follows allow/disallow rules and Sitemap reference

**Alternate Paths**:
- `Accept: text/markdown` on robots.txt: ignored; returns plain text regardless

**Error Paths**:
- Cloudflare Pages outage: CF serves from edge cache → no downtime
- Malformed robots.txt syntax: RFC 9309 parser skips unknown directives silently → no hard failure; fix in next commit

**Postconditions**: Crawler has a valid crawl policy; sitemap URL known; AI bot rules applied.

---

### Workflow: MCP Agent Discovery

**Trigger**: MCP orchestrator attempts Knowgrph integration

**Actors**: MCP Agent (P2), Cloudflare Worker (TAD-CF-WORKER)

**Happy Path**:
1. Agent fetches `/.well-known/mcp/server-card.json` → `200 application/json`
2. Agent reads `transport.url`, connects to MCP SSE endpoint
3. Agent fetches `/.well-known/oauth-protected-resource` → reads `authorization_servers`
4. Agent obtains token from listed IdP → calls Knowgrph API with Bearer token
5. Agent fetches `/.well-known/agent-skills/index.json` → enumerates available skills

**Alternate Paths**:
- MCP SSE endpoint unavailable: agent reports connection failure; server card is still served (discovery succeeds, connection fails gracefully)
- No token scope match: API returns `403`; agent surfaces error to user

**Error Paths**:
- Worker cold start latency > 50 ms on first request: Cloudflare edge caching of static JSON responses mitigates; `Cache-Control: public, max-age=3600` applied

**Postconditions**: Agent has transport URL, auth config, and skill manifest; can proceed to tool invocation or surface error to user.

---

### Workflow: Markdown Content Negotiation (Hugo Source-File Passthrough)

**Trigger**: AI agent or crawler requests a Knowgrph page with `Accept: text/markdown`

**Actors**: AI Crawler (P1), Cloudflare Worker (TAD-CF-WORKER), Cloudflare Pages (TAD-CF-PAGES)

**Happy Path**:
1. Agent sends `GET https://airvio.co/knowgrph` with `Accept: text/markdown`
2. Worker intercepts; detects `text/markdown` in Accept header on `/knowgrph*` route
3. Worker derives source path: `/knowgrph` → `self-fetch GET /knowgrph-src/_index.md`
4. CF Pages returns `200 text/plain` with stripped Markdown source
5. Worker re-serves as `200 text/markdown` with optional `x-markdown-tokens: N`
6. Agent parses Markdown — ~80% fewer tokens vs raw HTML

**Alternate Paths**:
- `GET /knowgrph/some-slug` with `Accept: text/markdown`: Worker maps to `/knowgrph-src/some-slug.md`; same flow
- Browser sends `Accept: text/html, */*`: Worker passes request through to CF Pages HTML output unchanged

**Error Paths**:
- `/knowgrph-src/[slug].md` returns 404 (auto-generated taxonomy page with no source):
  Worker falls back to HTML response; sets `Content-Type: text/html`; logs miss to Workers Analytics
- CI export step fails to copy source files: `/knowgrph-src/` empty → all Markdown requests fall back to HTML (degraded but not broken); 
  alert via GitHub Actions failure

**Postconditions**: Agent has compact Markdown content or HTML fallback; no 5xx errors;
token cost reduced for all successfully negotiated requests.

---

---

### Workflow: WebMCP Tool Registration

**Trigger**: Chrome (WebMCP EPP) loads `https://airvio.co/knowgrph`

**Actors**: Browser Agent (P2), Hugo-generated HTML (TAD-CF-WEBMCP), CF Pages

**Happy Path**:
1. Browser parses `<head>`; encounters inline synchronous `<script>` (first in `<head>`)
2. Script checks `typeof navigator.modelContext !== 'undefined'` → true (EPP Chrome)
3. `navigator.modelContext.provideContext({ tools: [search_graph] })` executes
4. `navigator.modelContext.tools` array populated before any navigation fires
5. Agent/extension reads tool definitions; can invoke `search_graph` on user request

**Alternate Paths**:
- Non-EPP Chrome / Firefox / Safari: `typeof navigator.modelContext === 'undefined'` → script exits silently; no error; HTML page renders normally

**Error Paths**:
- `provideContext()` throws (API signature change): try/catch in script logs to console only; page render unaffected
- Page navigates before script executes: impossible — inline sync `<head>` script runs before parser reaches `<body>` or any deferred script

**Postconditions**: On EPP Chrome, `navigator.modelContext.tools.length >= 1`; audit checker does not encounter "execution context destroyed" error; HTML render unaffected on all browsers.

### Data Flow: .well-known Endpoint Serve

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | Cloudflare Worker route match | HTTP GET request | Route + params | None | 404 on unmatched route |
| Transform | Worker dispatch | Route string | JSON file read from `worker/data/` | None | 500 + log on read error |
| Store | Git repo / Worker KV (optional) | JSON files | JSON | Git-committed seed files | Immutable; update via commit |
| Serve | Cloudflare Edge | JSON in-memory | HTTP response | Edge cache 1h | Cache-Control fallback |

### Data Flow: Markdown Source-File Serve

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | CF Worker | `GET /knowgrph[/slug]` + `Accept: text/markdown` | Route + slug | None | Pass-through to HTML on non-match |
| Transform | Worker path mapper | URL slug string | `/knowgrph-src/[slug].md` path | None | 404 → HTML fallback |
| Store | CF Pages `/public/knowgrph-src/` | CI-exported `.md` files | Static text/plain | Git-committed + CI export step | Empty dir → all fallback to HTML |
| Serve | CF Worker response | Markdown bytes | `200 text/markdown` + `x-markdown-tokens` | Edge cache 1h | 404 source → `200 text/html` passthrough |

| Stage | Component | Input Format | Output Format | Persistence | Error Handling |
|---|---|---|---|---|---|
| Ingest | Cloudflare Pages CDN | HTTP GET `/robots.txt` | Static file request | None | CF 404 page |
| Store | CF Pages `/public/` | Plain text file | Plain text | Git-committed | Redeploy on change |
| Serve | CF Pages CDN | Static bytes | `200 text/plain` | CF edge cache | Serve from nearest PoP |

---

## Architectural Decisions

### ADR-1: Single Worker for All .well-known Endpoints
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: 8+ distinct `.well-known` endpoints required; each could be a separate Worker, a Pages Function, or a committed static file.

**Decision**: One Cloudflare Worker (`knowgrph-agent-worker`) with route-based dispatch, reading JSON seed files from `worker/data/`. 
Static files (robots.txt, sitemap.xml) served via Pages `/public/` (no Worker needed for pure-static paths).

**Alternatives Considered**:
1. One Worker per endpoint: pros — isolation; cons — 8+ wrangler configs, maintenance overhead
2. All as Pages static files: pros — zero code; cons — cannot inject Link headers dynamically, cannot serve `application/linkset+json` with proper Content-Type routing

**Rationale**: Single Worker minimizes deployment surface, fits free tier, and allows dynamic header injection (Link headers, Cache-Control) that static Pages cannot provide.

**Consequences**:
- Positive: One deploy command (`wrangler deploy`) updates all endpoints; free tier sufficient
- Negative: Worker code must be maintained alongside JSON seed files
- Neutral: Cold-start latency mitigated by edge caching; negligible for discovery endpoints

---

### ADR-2: JSON Seed Files Externalized from Worker Code
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: MCP Server Card, API Catalog, Agent Skills index change more frequently than Worker routing logic.

**Decision**: JSON payloads committed as files in `worker/data/` and imported at Worker build time. 
For high-frequency updates, migrate to Cloudflare KV (still free tier up to 1k writes/day).

**Alternatives Considered**:
1. Inline JSON in Worker code: pros — one file; cons — requires recompile for every content update
2. Cloudflare KV from day 1: pros — runtime updateable; cons — adds KV write step to content update workflow; overkill for phase 1

**Rationale**: Git-committed JSON is zero-cost, auditable, and sufficient for infrequent discovery metadata updates. KV migration path is clear if update frequency increases.

**Consequences**:
- Positive: Content updates are PRs, not code deploys; zero KV cost phase 1
- Negative: Content and code share the same deploy cycle
- Neutral: KV migration is a 1-day effort when needed

---

### ADR-3: Markdown Negotiation via Cloudflare Platform Feature
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: Markdown for Agents requires detecting `Accept: text/markdown` and returning converted content. 
Options: Cloudflare platform toggle vs custom Worker HTML-to-Markdown conversion.

**Decision**: Use Cloudflare Pages "Markdown for Agents" platform feature if available as a project setting; otherwise implement lightweight Worker intercept using `@cloudflare/html-rewriter` + a minimal Markdown serializer (FOSS, no npm deps beyond CF SDK).

**Alternatives Considered**:
1. Server-side Pandoc/unified.js: pros — rich conversion; cons — not edge-compatible, adds dependency, increases Worker bundle size
2. Return raw HTML with `Content-Type: text/markdown`: violates spec; breaks agent parsers

**Rationale**: Platform toggle is zero-code, zero-cost. Worker fallback is ~50 lines using CF HTMLRewriter API, no external deps.

**Consequences**:
- Positive: Zero marginal cost; platform handles Accept header parsing
- Negative: Platform feature availability uncertain; Worker fallback needed as backup
- Neutral: Token reduction benefit accrues immediately for all agent consumers

---

### ADR-4: robots.txt AI Bot Policy — Allow All, No Training
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: Knowgrph benefits from AI crawler indexing (P1 persona) but does not consent to
training data use.

**Decision**: `Allow: /` for all named AI bots (GPTBot, Claude-Web, Google-Extended,
OAI-SearchBot) with `Content-Signal: ai-train=no, search=yes, ai-input=yes`.

**Rationale**: Knowgrph's positioning benefits from AI search indexing and agent-input use;
training consent is withheld by default pending commercial arrangements.

**Consequences**:
- Positive: Maximum discoverability; explicit training opt-out protects IP
- Negative: No enforcement mechanism; signals are advisory only
- Neutral: Policy can be updated per-bot as commercial context evolves

---

### ADR-5: Link Headers Scoped to `/knowgrph` Route Only
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: Knowgrph is at `airvio.co/knowgrph` — a subpath of a multi-project domain.
`airvio.co` likely serves other projects (`/singapoly`, `/hackamap`, etc.). 
Link headers advertising Knowgrph's `.well-known` endpoints must not appear on unrelated subpaths.

**Decision**: Worker route `airvio.co/knowgrph` (exact match) triggers Link header injection;
`airvio.co/knowgrph/*` routes do not inject (subpages don't advertise discovery again). 
All other `airvio.co` routes bypass Link header logic entirely via route allowlist in Worker.

**Alternatives Considered**:
1. Inject on all `airvio.co/*` responses: pros — simpler route logic; cons — other projects get Knowgrph headers, breaks RFC 8288 semantics (Link headers should describe the resource they accompany)
2. Separate Worker per project: pros — full isolation; cons — multiple wrangler configs, conflicts on shared zone

**Rationale**: Route allowlist is 3 lines in Worker dispatch; zero cost; correct semantics.

**Consequences**:
- Positive: Clean header separation across `airvio.co` projects
- Negative: Adding a new project to `airvio.co` requires updating Worker allowlist
- Neutral: Header injection is idempotent — safe to deploy alongside other Workers on the zone

---

### ADR-6: Hugo Source-File Passthrough for Markdown Negotiation
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: Markdown Negotiation requires returning Markdown content for `Accept: text/markdown` requests. 
Two approaches: (A) convert rendered HTML to Markdown on the fly using HTMLRewriter + serializer; (B) serve the Hugo source `.md` files directly.

**Decision**: Option B — Hugo source-file passthrough. 
A CI build step (`scripts/export-md-src.sh`) copies `content/knowgrph/*.md` into `public/knowgrph-src/` with front matter stripped. 
CF Pages serves these as static assets. Worker maps URL path to source file and returns it verbatim.

**Alternatives Considered**:
1. HTMLRewriter + Markdown serializer (Option A): pros — no build step, always in sync with
   rendered output; cons — lossy conversion (nav, structured data stripped inconsistently),
   adds ~3 KB to Worker bundle, conversion quality varies per page template, higher CPU per
   request (cost at scale)
2. CF Pages "Markdown for Agents" platform toggle: pros — zero code; cons — feature
   availability unconfirmed for subpath deployments; may not scope to `/knowgrph` only

**Rationale**: Hugo source files ARE the canonical Markdown. 
Serving them directly is lossless, zero-dependency, and produces the most token-efficient output (no rendered boilerplate). 
CI export step is ~5 lines of shell. The build step cost is paid once per deploy, not per request.

**Consequences**:
- Positive: Lossless Markdown; ~80% token reduction vs HTML; zero Worker CPU for conversion
- Negative: Source files must be kept in sync via CI export step; deleted pages need cleanup
- Neutral: Source files are public (already in a public repo); no secrets exposure risk

---

### ADR-7: WebMCP Inline `<head>` Injection via Hugo Section Partial
**Status**: Proposed  
**Date**: 2026-05-21

**Context**: WebMCP audit failure was a browser lifecycle race — `provideContext()` was not called before page navigation destroyed the execution context. 
Two fix approaches: (A) external `<script src>` with `async`/`defer`; (B) inline `<script>` in `<head>`, synchronous, first-in-head.

**Decision**: Option B — inline synchronous `<script>` as the first element in `<head>` via Hugo partial `layouts/knowgrph/baseof.html`. 
Guarded by `typeof navigator.modelContext !== 'undefined'` to no-op silently on non-EPP Chrome and all other browsers.

**Alternatives Considered**:
1. External script with `defer`: pros — cacheable; cons — deferred scripts run after DOM parse, may still lose the race against navigation events; does not fix the root cause
2. Cloudflare Worker `<head>` injection via HTMLRewriter: pros — no Hugo template change; cons — adds Worker CPU per request, requires HTMLRewriter dependency, harder to maintain

**Rationale**: Inline synchronous `<head>` script is the only guaranteed-first execution path in a static HTML page. 
Hugo partial scoping ensures zero impact on non-Knowgrph pages.
Implementation is ~20 lines of inline JS with a `typeof` guard — zero dependencies, zero cost.

**Consequences**:
- Positive: Fixes audit failure at root cause; works on EPP Chrome; silent no-op elsewhere
- Negative: Inline script cannot be cached separately; adds ~500 bytes to every Knowgrph HTML page
- Neutral: Tool stubs (`search_graph`) return empty results until phase 2 API is wired

| Attribute | Scenario | Pattern | Validation |
|---|---|---|---|
| Performance | 1000 simultaneous agent crawls → all .well-known endpoints < 50 ms P99 | Cloudflare edge caching (`Cache-Control: max-age=3600`) | CF Workers Analytics → P99 latency |
| Scalability | Knowgrph indexed by 10+ major AI crawlers simultaneously | Cloudflare global CDN, stateless Worker | CF dashboard request volume check |
| Security | Malicious agent attempts path traversal on Worker routes | Route allowlist in Worker; no filesystem access | Security audit: fuzz unregistered routes → all return 404 |
| Observability | Deploy fails silently → endpoints return 404 | `wrangler tail` log streaming; CF Workers Analytics | Post-deploy smoke test: `curl` all 7 endpoints, assert 200 |
| Token Efficiency | Agent fetches Knowgrph page → consumes minimum LLM tokens | Markdown negotiation reduces payload ~80% | Compare token count: HTML vs Markdown response on homepage |

---

## Deployment Strategy

**Approach**: Rolling deploy via Wrangler CLI. No blue-green needed (stateless Worker, no DB migration risk). 
Rollback: `wrangler rollback` restores previous deployment within 30 s.

**Deploy sequence**:
1. Commit JSON seed files and Worker code to `main`
2. CI runs `wrangler deploy` (GitHub Actions, free tier)
3. Post-deploy smoke test script curls all 7 `.well-known` endpoints and `/robots.txt`
4. isitagentready.com re-scan confirms score improvement
5. Tag release `v1.0.0` in Git

**Rollback plan**: `wrangler rollback` → previous Worker version served from CF edge within one propagation cycle (~30 s globally).

---

## Architecture Diagrams

### System Topology

```mermaid
flowchart TB
    subgraph Agents
        A1[AI Crawler\nGPTBot / Claude-Web]
        A2[MCP Agent\nOrchestrator]
        A3[Developer\nAgent Builder]
        A4[Browser Agent\nWebMCP]
    end

    subgraph Cloudflare Edge
        CF_CDN[Cloudflare CDN\nPages]
        CF_W[knowgrph-agent-worker\nWorker]
    end

    subgraph Static Assets
        ST_ROBOTS[/public/robots.txt]
        ST_SITEMAP[/public/sitemap.xml]
        ST_OPENAPI[/public/openapi.json]
    end

    subgraph Worker Data
        D_APICAT[worker/data/api-catalog.json]
        D_OAUTH[worker/data/oauth-protected-resource.json]
        D_MCP[worker/data/mcp-server-card.json]
        D_SKILLS[worker/data/agent-skills-index.json]
        D_JWKS[worker/data/jwks.json]
    end

    subgraph External
        EXT_IDP[OAuth / OIDC Provider\nCloudflare Access]
        EXT_MCP[Knowgrph MCP SSE\nEndpoint]
    end

    A1 -->|GET /robots.txt| CF_CDN
    A1 -->|GET /sitemap.xml| CF_CDN
    A1 -->|Accept: text/markdown| CF_W
    A2 -->|GET /.well-known/mcp/*| CF_W
    A2 -->|GET /.well-known/oauth-*| CF_W
    A2 -->|Token → MCP SSE| EXT_MCP
    A3 -->|GET /.well-known/api-catalog| CF_W
    A3 -->|GET /.well-known/agent-skills/*| CF_W
    A4 -->|navigator.modelContext| CF_CDN

    CF_CDN --> ST_ROBOTS
    CF_CDN --> ST_SITEMAP
    CF_CDN --> ST_OPENAPI
    CF_W --> D_APICAT
    CF_W --> D_OAUTH
    CF_W --> D_MCP
    CF_W --> D_SKILLS
    CF_W --> D_JWKS
    CF_W -->|Link header inject on GET /| CF_CDN

    D_OAUTH -.->|references| EXT_IDP
    D_MCP -.->|transport URL| EXT_MCP
```

### Worker Route Dispatch Flow

```mermaid
flowchart LR
    REQ[Incoming Request] --> MATCH{Route Match}

    MATCH -->|/robots.txt| PAGES[CF Pages Static]
    MATCH -->|/sitemap.xml| PAGES
    MATCH -->|GET /| INJECT[Link Header Inject\n+ pass-through to Pages]
    MATCH -->|Accept: text/markdown| MD[Markdown Negotiation\nHTMLRewriter]
    MATCH -->|/.well-known/api-catalog| APICAT[Serve api-catalog.json]
    MATCH -->|/.well-known/oauth-protected-resource| OAUTH[Serve oauth-pr.json]
    MATCH -->|/.well-known/mcp/server-card.json| MCP[Serve mcp-server-card.json]
    MATCH -->|/.well-known/agent-skills/index.json| SKILLS[Serve agent-skills-index.json]
    MATCH -->|/.well-known/http-message-signatures-directory| JWKS[Serve jwks.json]
    MATCH -->|Unmatched| R404[404 Not Found]

    APICAT --> RESP[200 application/linkset+json]
    OAUTH --> RESP2[200 application/json]
    MCP --> RESP3[200 application/json]
    SKILLS --> RESP4[200 application/json]
    JWKS --> RESP5[200 application/json]
    MD --> RESP6[200 text/markdown]
    INJECT --> RESP7[2xx + Link headers]
```

### MCP Agent Discovery Sequence

```mermaid
sequenceDiagram
    participant AG as MCP Agent
    participant CF as Cloudflare Worker
    participant IDP as OAuth Provider
    participant MCP as MCP SSE Server

    AG->>CF: GET /.well-known/mcp/server-card.json
    CF-->>AG: 200 {serverInfo, transport.url, capabilities}

    AG->>CF: GET /.well-known/oauth-protected-resource
    CF-->>AG: 200 {resource, authorization_servers, scopes_supported}

    AG->>IDP: OAuth token request (client_credentials)
    IDP-->>AG: access_token

    AG->>CF: GET /.well-known/agent-skills/index.json
    CF-->>AG: 200 {$schema, skills: [...]}

    AG->>MCP: MCP initialize (Bearer token)
    MCP-->>AG: InitializeResult {capabilities, tools}

    AG->>MCP: tools/call {name: "search_graph", args: {...}}
    MCP-->>AG: tool result
```

---

## Component Inventory

| Layer | Component | File / Module | Status |
|---|---|---|---|
| Static | robots.txt | `public/robots.txt` | 🔲 To build |
| Static | sitemap.xml | `public/sitemap.xml` | 🔲 To build |
| Static | OpenAPI spec (stub) | `public/openapi.json` | 🔲 To build |
| Static | Markdown source export | `public/knowgrph-src/*.md` | 🔲 To build (CI step) |
| CI | MD source export script | `scripts/export-md-src.sh` | 🔲 To build |
| Hugo | WebMCP head partial | `layouts/knowgrph/baseof.html` | 🔲 To build |
| Worker | Route dispatcher | `worker/src/index.ts` | 🔲 To build |
| Worker | Markdown negotiation | `worker/src/markdown.ts` | 🔲 To build |
| Worker | Link header injector | `worker/src/link-headers.ts` | 🔲 To build |
| Worker | `wrangler.toml` routes | `worker/wrangler.toml` | 🔲 To build |
| Worker Data | API Catalog | `worker/data/api-catalog.json` | 🔲 To build |
| Worker Data | OAuth Protected Resource | `worker/data/oauth-protected-resource.json` | 🔲 To build |
| Worker Data | MCP Server Card | `worker/data/mcp-server-card.json` | 🔲 To build |
| Worker Data | Agent Skills Index | `worker/data/agent-skills-index.json` | 🔲 To build |
| Worker Data | JWKS | `worker/data/jwks.json` | 🔲 To build |
| CI | Deploy workflow | `.github/workflows/deploy.yml` | 🔲 To build |
| CI | Smoke test | `.github/workflows/smoke-test.sh` | 🔲 To build |

---

## PRD ↔ TAD Traceability

| PRD Story | TAD Component | Interface | `/goal` Condition |
|---|---|---|---|
| PRD-E1-S1 | TAD-CF-STATIC | `GET /robots.txt` | `curl https://airvio.co/robots.txt returns 200 text/plain with User-agent lines` |
| PRD-E1-S2 | TAD-CF-STATIC | `GET /sitemap.xml` | `curl https://airvio.co/sitemap.xml returns 200 XML with <url> elements` |
| PRD-E1-S3 | TAD-CF-WORKER | `GET /knowgrph → Link headers` | `curl -sI https://airvio.co/knowgrph contains Link:.*rel="api-catalog"; curl -sI https://airvio.co/ does NOT` |
| PRD-E2-S1 | TAD-CF-PAGES | `Accept: text/markdown on /knowgrph*` | `curl -sH "Accept: text/markdown" https://airvio.co/knowgrph returns Content-Type: text/markdown; body has no <html` |
| PRD-E3-S1 | TAD-CF-STATIC | `GET /robots.txt` | `grep -c "User-agent: GPTBot\|Claude-Web\|Google-Extended\|OAI-SearchBot" /robots.txt returns 4` |
| PRD-E3-S2 | TAD-CF-STATIC | `GET /robots.txt` | `grep "Content-Signal:" /robots.txt returns 1 match with ai-train, search, ai-input` |
| PRD-E3-S3 | TAD-CF-BOTAUTH | `GET /.well-known/http-message-signatures-directory` | `curl https://airvio.co/.well-known/http-message-signatures-directory returns 200 JSON with keys array` |
| PRD-E4-S1 | TAD-CF-WORKER | `GET /.well-known/api-catalog` | `curl https://airvio.co/.well-known/api-catalog returns 200 application/linkset+json with linkset[0].anchor` |
| PRD-E4-S2 | TAD-CF-WORKER | `GET /.well-known/oauth-protected-resource` | `curl https://airvio.co/.well-known/oauth-protected-resource returns 200 JSON with authorization_servers` |
| PRD-E4-S3 | TAD-CF-WORKER | `GET /.well-known/mcp/server-card.json` | `curl https://airvio.co/.well-known/mcp/server-card.json returns 200 JSON with serverInfo.name and transport` |
| PRD-E4-S4 | TAD-CF-WORKER | `GET /.well-known/agent-skills/index.json` | `curl https://airvio.co/.well-known/agent-skills/index.json returns 200 JSON with skills[].name` |
| PRD-E4-S5 | TAD-CF-WEBMCP | `navigator.modelContext in <head>` | `grep -c provideContext layouts/knowgrph/baseof.html returns >= 1; navigator.modelContext?.tools?.length >= 1 in Chrome console on airvio.co/knowgrph` |

---

## JSON Contract Schemas (Seed File Reference)

### `worker/data/mcp-server-card.json` (stub)
```json
{
  "serverInfo": {
    "name": "knowgrph-mcp",
    "version": "0.1.0"
  },
  "transport": {
    "type": "sse",
    "url": "https://knowgrph.io/mcp/sse"
  },
  "capabilities": {
    "tools": true,
    "resources": false,
    "prompts": false
  }
}
```

### `worker/data/agent-skills-index.json` (stub)
```json
{
  "$schema": "https://agentskills.io/schema/v0.2.0/index.json",
  "skills": [
    {
      "name": "search-graph",
      "type": "mcp-tool",
      "description": "Search Knowgrph knowledge graph nodes by query string",
      "url": "https://knowgrph.io/.well-known/agent-skills/search-graph/SKILL.md",
      "sha256": "<computed-on-publish>"
    }
  ]
}
```

### `worker/data/api-catalog.json` (stub)
```json
{
  "linkset": [
    {
      "anchor": "https://knowgrph.io/api",
      "service-desc": [{"href": "https://knowgrph.io/openapi.json", "type": "application/json"}],
      "service-doc": [{"href": "https://docs.knowgrph.io", "type": "text/html"}]
    }
  ]
}
```

### `/public/robots.txt` (seed)
```
User-agent: *
Allow: /
Crawl-delay: 2

User-agent: GPTBot
Allow: /
Disallow: /api/private/

User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Google-Extended
Allow: /

Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: https://knowgrph.io/sitemap.xml
```

---

## Validation Checklist

**Pre-Implementation**:
- [x] User journeys mapped before stories written (AI Crawler, MCP Agent journeys)
- [x] Workflows defined with trigger, happy/alternate/error paths, postconditions
- [x] Data flows typed at every stage boundary with persistence and error handling
- [x] User stories follow "As a… I want… So that" format
- [x] Acceptance criteria use Given-When-Then with observable outcomes
- [x] Every acceptance criterion translatable to a `/goal` condition
- [x] Features prioritized via MoSCoW with rationale
- [x] Components have single responsibility; interfaces specified with explicit contracts
- [x] Architectural decisions documented with ADRs (ADR-1 through ADR-4)
- [x] Architecture diagrams use Mermaid (3 diagrams: topology, route flow, sequence)
- [x] Component inventory table accompanies every architecture diagram
- [x] PRD-to-TAD traceability established via full traceability matrix
- [x] `/goal` conditions recorded in TAD component specs and traced to source criteria
- [x] No implementation detail in PRD; no business logic in TAD

**Post-Documentation Review**:
- [ ] OQ-1 resolved (OAuth provider decision)
- [ ] OQ-2 resolved (MCP SSE stub vs real endpoint)
- [ ] OQ-3 resolved (sitemap generation strategy)
- [ ] OQ-4 resolved (Content Signals policy confirmed)
- [ ] OQ-5 resolved (WebMCP EPP audience decision)
- [ ] isitagentready.com re-scan post-deploy confirms ≥ 11/13

---

*Document version: 1.1.0 — Proposed — 2026-05-21*  
*Changes: E1-S3 Link Headers enhanced (subpath scoping, path-bleed guard, exact header set); E2-S1 Markdown Negotiation enhanced (Hugo source-file passthrough strategy, CI export step, fallback chain); E4-S5 WebMCP promoted from Could to Should (lifecycle race root-cause analysis, Hugo partial inline script strategy, guard pattern); ADR-5/6/7 added; all URLs corrected to `airvio.co/knowgrph`; OQ-5/6/7 added; component inventory updated.*  
*Next review: post-sprint-1 deploy (target: 2026-06-04)*