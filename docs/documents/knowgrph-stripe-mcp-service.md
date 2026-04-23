---
title: Knowgrph · Stripe MCP Service — B2C Monetization + Checkout (Video Generation Flow Editor)
graphId: md:knowgrph-stripe-mcp-service
product: "Knowgrph Canvas"
service_type: "AI-native · MCP-based · OpenClaw-friendly · FOSS-first · token-economics-first"
doc_type: "Recommendation (PRD + TAD aligned)"
version: "0.1.0"
owner: "joohwee"
status: "draft"
date: "2026-04-18"
license: "FOSS"
tier: "free + pay-per-use + subscription"
ai_model: "provider-swappable"

dev_repo: "/Users/huijoohwee/Documents/GitHub/knowgrph"
prod_repo: "/Users/huijoohwee/Documents/GitHub/huijoohwee/knowgrph"
cloudflare_host: "airvio.co/knowgrph"

billing_provider: "Stripe"
checkout_ux: "Stripe Checkout (MainPanel)"
provider_registry: "OpenClaw"
commerce_protocol: "Agentic Commerce Protocol (ACP) inspired catalog"
commerce_docs: "https://developers.openai.com/commerce"
stripe_payment_links_docs: "https://docs.stripe.com/payment-links"
stripe_checkout_sessions_api_docs: "https://docs.stripe.com/api/checkout/sessions"
stripe_checkout_mode: "Payment Links (preferred) → Checkout Session (optional)"

primary_use_case: "Video Generation Flow Editor Service"
icp: "solo creators + indie teams shipping short-form video workflows"

# ── runtime ───────────────────────────────────────────────────────────────────
# {{runtime.*}} resolves in body prose + Pipeline table cells.
runtime:
  entry:    {key: entry,    type: string,  value: "n-scope"}
  exit:     {key: exit,     type: string,  value: "n-deploy"}
  sandbox:  {key: sandbox,  type: string,  value: "quickjs-emscripten"}
  trace:    {key: trace,    type: boolean, value: true}
  maxRetry: {key: maxRetry, type: number,  value: 3}

# ── mcp ───────────────────────────────────────────────────────────────────────
# {{mcp.*}} resolves in body prose + pipeline. Tool names are SSOT and MUST remain
# stable for OpenClaw-friendly registries.
mcp:
  server_url:          {key: server_url,          type: string, value: "mcp://localhost:3120"}
  tool_pricing_get:    {key: tool_pricing_get,    type: string, value: "billing_pricing_get"}
  tool_quote:          {key: tool_quote,          type: string, value: "billing_quote"}
  tool_checkout_create:{key: tool_checkout_create,type: string, value: "billing_checkout_create"}
  tool_checkout_status:{key: tool_checkout_status,type: string, value: "billing_checkout_status"}
  tool_checkout_session_get:{key: tool_checkout_session_get,type: string, value: "billing_checkout_session_get"}
  tool_checkout_session_expire:{key: tool_checkout_session_expire,type: string, value: "billing_checkout_session_expire"}
  tool_checkout_session_line_items:{key: tool_checkout_session_line_items,type: string, value: "billing_checkout_session_line_items_get"}
  tool_payment_link_get:{key: tool_payment_link_get,type: string, value: "billing_payment_link_get"}
  tool_payment_link_create:{key: tool_payment_link_create,type: string, value: "billing_payment_link_create"}
  tool_usage_meter:    {key: tool_usage_meter,    type: string, value: "billing_usage_meter"}
  tool_entitlements:   {key: tool_entitlements,   type: string, value: "billing_entitlements_get"}
  timeout_s:           {key: timeout_s,           type: number, value: 15}
  auth:                {key: auth,                type: string, value: "bearer-token (optional)"}

# ── economics ─────────────────────────────────────────────────────────────────
# Token performance/economics are first-class: quote and clamp BEFORE compute.
economics:
  token_budget_context:      {key: token_budget_context,      type: number, value: 1024}
  token_budget_response:     {key: token_budget_response,     type: number, value: 1536}
  mcp_tax_tokens:            {key: mcp_tax_tokens,            type: number, value: 150}
  free_tier_credits_daily:   {key: free_tier_credits_daily,   type: number, value: 50}
  free_tier_gens_daily:      {key: free_tier_gens_daily,      type: number, value: 3}
  paid_unit:                 {key: paid_unit,                 type: string, value: "compute_credits"}
  price_per_credit_usd:      {key: price_per_credit_usd,      type: number, value: 0.02}
  subscription_monthly_usd:  {key: subscription_monthly_usd,  type: number, value: 12}
  cache_ttl_days:            {key: cache_ttl_days,            type: number, value: 30}
  no_double_charge:          {key: no_double_charge,          type: boolean, value: true}
  quote_basis:               {key: quote_basis,               type: string, value: "duration_s × res_factor × fps_factor × model_factor"}

# ── pipeline ──────────────────────────────────────────────────────────────────
# This plan is a delivery pipeline (implementation steps), not the runtime DAG.
# pipeline[*].node MUST match flow.nodes[*].id AND mermaid node IDs exactly.
pipeline:
  - seq: S01
    node: n-scope
    label: "scope lock + monetization surfaces"
    actor: ["founder","system"]
    edge_in: "—"
    edge_out: spec_pkg
    user_action: "Confirm B2C actions to monetize: run, export, share, publish, template, marketplace; confirm catalog + variants"
    sys_event: "Freeze SSOT: Stripe checkout UX rules, pricing entities, Stripe mapping, free-tier constraints, ACP-inspired catalog schema"
    data_in: "—"
    data_out: "spec_pkg {monetized_actions, pricing_model, entitlements, free_tier_policy, catalog_schema}"
    trigger: plan-start
    on_fail: "@flag:blocking — unclear monetized actions causes churn"
    kanban: in-flight
    confidence: high
    status: TBD

  - seq: S02
    node: n-actions
    label: "define B2C action meter + entitlements + catalog (ACP-inspired)"
    actor: ["system"]
    edge_in: spec_pkg
    edge_out: action_pkg
    user_action: "—"
    sys_event: "Implement action taxonomy + entitlement rules; define catalog items + variants + attribution; bind to VideoGeneration and export/share actions"
    data_in: "spec_pkg"
    data_out: "action_pkg {action_types, meter_keys, entitlement_rules, catalog_items, variant_rules, attribution_rules}"
    trigger: spec_pkg non-null
    on_fail: "@flag:contract-drift — cannot price or cap consistently"
    kanban: backlog
    confidence: high
    status: TBD

  - seq: S03
    node: n-mcp
    label: "build Stripe Billing MCP Service (Stripe-backed)"
    actor: ["system"]
    edge_in: action_pkg
    edge_out: service_pkg
    user_action: "—"
    sys_event: "Expose MCP tools for pricing, quote, Stripe Payment Links, Checkout Sessions, usage metering, entitlements; add caching and idempotency"
    data_in: "action_pkg"
    data_out: "service_pkg {mcp_tools, stripe_adapter, cache_layer}"
    trigger: action_pkg non-null
    on_fail: "@flag:service-unavailable — cannot create checkout reliably"
    kanban: backlog
    confidence: high
    status: TBD

  - seq: S04
    node: n-ui
    label: "MainPanel Stripe checkout integration"
    actor: ["founder","system"]
    edge_in: service_pkg
    edge_out: ui_pkg
    user_action: "Stripe checkout appears at the moment of intent (Run/Export/Publish)"
    sys_event: "Integrate MainPanel: quote → Payment Link (default) or Checkout Session (fallback) → entitlement refresh; show price clarity and free-tier remaining"
    data_in: "service_pkg"
    data_out: "ui_pkg {checkout_surface, price_badges, paywall_triggers, session_reconciliation}"
    trigger: service_pkg non-null
    on_fail: "@flag:ux-incomplete — conversion suffers"
    kanban: backlog
    confidence: medium
    status: TBD

  - seq: S05
    node: n-ops
    label: "token economics, caching, and TCO controls"
    actor: ["system"]
    edge_in: ui_pkg
    edge_out: ops_pkg
    user_action: "—"
    sys_event: "Add cache keys, quote preflight, no double charge, and observability for token/cost; enforce free-tier clamps"
    data_in: "ui_pkg"
    data_out: "ops_pkg {cache_keys, quota_enforcer, cost_metrics}"
    trigger: ui_pkg non-null
    on_fail: "@flag:tco-risk — costs become unpredictable"
    kanban: backlog
    confidence: medium
    status: TBD

  - seq: S06
    node: n-deploy
    label: "Dev → Prod → Cloudflare release"
    actor: ["system"]
    edge_in: ops_pkg
    edge_out: "—"
    user_action: "Verify end-to-end checkout + entitlement unlock on {{cloudflare_host}}"
    sys_event: "Deploy control plane; configure Stripe webhooks; publish OpenClaw registry entry; add docs"
    data_in: "ops_pkg"
    data_out: "deployed Stripe billing surface"
    trigger: ops_pkg non-null
    on_fail: "@flag:deploy-failed — rollback to last known good"
    kanban: backlog
    confidence: medium
    status: TBD

# ── mermaid ───────────────────────────────────────────────────────────────────
# NEVER use {{}} inside this block.
mermaid: |
  %%{init: {"theme": "base", "themeVariables": {"primaryColor":"#E1F5EE","primaryTextColor":"#085041","primaryBorderColor":"#1D9E75","lineColor":"#5F5E5A","secondaryColor":"#E6F1FB","tertiaryColor":"#FAEEDA"}}}%%
  flowchart LR
    classDef persona fill:#E1F5EE,stroke:#1D9E75,color:#085041,stroke-width:1.5px
    classDef process fill:#E6F1FB,stroke:#378ADD,color:#0C447C,stroke-width:1.5px
    classDef store   fill:#F1EFE8,stroke:#888780,color:#444441,stroke-width:1px
    classDef output  fill:#EAF3DE,stroke:#639922,color:#27500A,stroke-width:1.5px
    classDef bill    fill:#FAEEDA,stroke:#BA7517,color:#633806,stroke-width:1.5px

    User(["B2C creator"])
    MainPanel[/"MainPanel\nStripe checkout"/]
    Stripe[/"Stripe Billing"/]
    DB[("entitlements\nusage_ledger\npricing")]
    OpenClaw[/"OpenClaw registry"/]
    VideoSvc[/"Video Gen Service"/]

    subgraph P1["S01–S02 · Define"]
      n-scope["S01 · n-scope\nmonetization surfaces"]
      n-actions["S02 · n-actions\naction meter + entitlements + catalog"]
      n-scope --> n-actions
    end

    subgraph P2["S03–S05 · Build"]
      n-mcp["S03 · n-mcp\nStripe Billing MCP Service"]
      n-ui["S04 · n-ui\nMainPanel Stripe integration"]
      n-ops["S05 · n-ops\ntoken economics + TCO"]
      n-actions --> n-mcp --> n-ui --> n-ops
    end

    subgraph P3["S06 · Ship"]
      n-deploy["S06 · n-deploy\nDev → Prod → Cloudflare"]
      n-ops --> n-deploy
    end

    User -->|intent| MainPanel
    MainPanel -->|checkout| Stripe
    n-mcp -->|webhooks| Stripe
    n-mcp -->|read/write| DB
    VideoSvc -->|preflight quote| n-mcp
    n-deploy -->|register tools| OpenClaw

    class User persona
    class MainPanel process
    class VideoSvc process
    class n-scope,n-actions,n-mcp,n-ui,n-ops process
    class n-deploy output
    class Stripe bill
    class DB store
    class OpenClaw process

    click n-scope "#pipeline--from-0-to-1" "S01 · scope lock"
    click n-actions "#pipeline--from-0-to-1" "S02 · action meter"
    click n-mcp "#pipeline--from-0-to-1" "S03 · MCP service"
    click n-ui "#pipeline--from-0-to-1" "S04 · Stripe checkout"
    click n-ops "#pipeline--from-0-to-1" "S05 · economics"
    click n-deploy "#pipeline--from-0-to-1" "S06 · deploy"

# ── flow ──────────────────────────────────────────────────────────────────────
# Machine-readable plan nodes; compute bodies are intentionally pure.
flow:
  direction:  {key: direction,  type: string,  value: LR}
  edgeType:   {key: edgeType,   type: string,  value: smoothstep}
  snapToGrid: {key: snapToGrid, type: boolean, value: true}
  computed:   {key: computed,   type: boolean, value: true}

  nodes:
    - id:            {key: id,            type: string,   value: "n-scope"}
      type:          {key: type,          type: string,   value: "input"}
      label:         {key: label,         type: string,   value: "S01 · defineMonetizedActions()"}
      phase:         {key: phase,         type: string,   value: "define"}
      actor:         {key: actor,         type: array,    value: ["founder","system"]}
      handles:       {key: handles,       type: object,   value: {source: ["spec_pkg"]}}
      data:          {key: data,          type: object,   value: {use_case: "Video Generation Flow Editor", surface: "MainPanel", checkout: "Stripe"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-06","V-07"]}
      db_writes:     {key: db_writes,     type: string,   value: "pricing"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "in-flight"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ spec_pkg: inputs.__seed ? { ok: true } : { ok: true } })
      }

    - id:            {key: id,            type: string,   value: "n-actions"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S02 · buildEntitlementsAndCatalogPolicy()"}
      phase:         {key: phase,         type: string,   value: "contract"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["spec_pkg"], source: ["action_pkg"]}}
      data:          {key: data,          type: object,   value: {entitlements: ["free_tier","credits","subscription"], meter: "per-action", acp_inspired_catalog: true, catalog_update_mode: "snapshot + upsert"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-04"]}
      db_writes:     {key: db_writes,     type: string,   value: "entitlements"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ action_pkg: inputs.spec_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-mcp"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S03 · serveBillingTools()"}
      phase:         {key: phase,         type: string,   value: "build"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["action_pkg"], source: ["service_pkg"]}}
      data:          {key: data,          type: object,   value: {tools: ["billing_pricing_get","billing_quote","billing_payment_link_get","billing_payment_link_create","billing_checkout_create","billing_checkout_status","billing_usage_meter","billing_entitlements_get"], provider: "Stripe"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-01","V-03","V-05","V-07"]}
      db_writes:     {key: db_writes,     type: string,   value: "usage_ledger"}
      retry_arc:     {key: retry_arc,     type: string,   value: "source"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ service_pkg: inputs.action_pkg ? { ok: true, server_url: "mcp://localhost:3120" } : null })
      }

    - id:            {key: id,            type: string,   value: "n-ui"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S04 · integrateStripeCheckout()"}
      phase:         {key: phase,         type: string,   value: "integrate"}
      actor:         {key: actor,         type: array,    value: ["founder","system"]}
      handles:       {key: handles,       type: object,   value: {target: ["service_pkg"], source: ["ui_pkg"]}}
      data:          {key: data,          type: object,   value: {surface: "MainPanel", stripe_checkout: true, moments: ["run","export","publish"], prefer_payment_links: true}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-06","V-07"]}
      db_writes:     {key: db_writes,     type: string,   value: "—"}
      retry_arc:     {key: retry_arc,     type: string,   value: "target"}
      confidence:    {key: confidence,    type: string,   value: "medium"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ ui_pkg: inputs.service_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-ops"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S05 · enforceEconomicsGuards()"}
      phase:         {key: phase,         type: string,   value: "optimize"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["ui_pkg"], source: ["ops_pkg"]}}
      data:          {key: data,          type: object,   value: {quote_before_compute: true, cache: true, no_double_charge: true}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-05"]}
      db_writes:     {key: db_writes,     type: string,   value: "usage_ledger"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "medium"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ ops_pkg: inputs.ui_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-deploy"}
      type:          {key: type,          type: string,   value: "output"}
      label:         {key: label,         type: string,   value: "S06 · deployStripeSurface()"}
      phase:         {key: phase,         type: string,   value: "release"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["ops_pkg"]}}
      data:          {key: data,          type: object,   value: {host: "cloudflare", registry: "OpenClaw", url: "airvio.co/knowgrph"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03"]}
      db_writes:     {key: db_writes,     type: string,   value: "entitlements, usage_ledger, pricing"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "medium"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ delivered: inputs.ops_pkg ? { ok: true } : null })
      }

  edges:
    - {id: e1, source: n-scope,   sourceHandle: spec_pkg,   target: n-actions, targetHandle: spec_pkg,   animated: true}
    - {id: e2, source: n-actions, sourceHandle: action_pkg, target: n-mcp,     targetHandle: action_pkg, animated: true}
    - {id: e3, source: n-mcp,     sourceHandle: service_pkg,target: n-ui,      targetHandle: service_pkg,animated: true}
    - {id: e4, source: n-ui,      sourceHandle: ui_pkg,     target: n-ops,     targetHandle: ui_pkg,     animated: true}
    - {id: e5, source: n-ops,     sourceHandle: ops_pkg,    target: n-deploy,  targetHandle: ops_pkg,    animated: true}
---

# Knowgrph · Stripe MCP Service — B2C Monetization + Checkout (Video Generation Flow Editor)

`bg#E1F5EE:version {{version}}` · `bg#FAEEDA:status {{status}}` · owner `{{owner}}` · {{date}} · `bg#EAF3DE:{{license}}` · tier `{{tier}}`

> This document recommends a **Stripe Billing MCP Service** that monetizes B2C user actions inside Knowgrph’s MainPanel for the Video Generation Flow Editor. YAML frontmatter is the machine-readable SSOT (`mermaid:`, `flow:`, `pipeline:`); the body is the human-readable projection, organized by **From 0 to 1** and the three lenses: `bg#E1F5EE:UF` user flow, `bg#E6F1FB:WF` work flow, `bg#EAF3DE:DF` data flow.

---

## Flow Graph

```mermaid
{{mermaid}}
```

### Frontmatter → body linkage map

| Frontmatter key | Resolves in body as | Example |
|---|---|---|
| `runtime.maxRetry` | `{{runtime.maxRetry}}` | retry arc ≤ `{{runtime.maxRetry}}` |
| `mcp.tool_payment_link_get` | `{{mcp.tool_payment_link_get}}` | open hosted checkout via Payment Link |
| `mcp.tool_checkout_create` | `{{mcp.tool_checkout_create}}` | fallback to Checkout Session |
| `economics.free_tier_gens_daily` | `{{economics.free_tier_gens_daily}}` | cap = `{{economics.free_tier_gens_daily}}` |
| `pipeline[*].node` | `@node:<id>` | `@node:n-ui` |
| `flow.edges[*]` | `@edge:src:h→tgt:h` | `@edge:n-mcp:service_pkg→n-ui:service_pkg` |

---

## Pipeline — From 0 to 1

Human-readable projection of `pipeline:` frontmatter. Column header sigils encode perspective: `bg#E1F5EE:UF` user flow, `bg#E6F1FB:WF` work flow, `bg#EAF3DE:DF` data flow.

| seq | `@node:id` | pipeline step | `bg#E1F5EE:UF` user action | `bg#E6F1FB:WF` system event | `bg#EAF3DE:DF` data in | `bg#EAF3DE:DF` data out | edge | actor | trigger | on fail | kanban | confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `S01` | `@node:n-scope` | `bg#E6F1FB:define surface` | Confirm monetized actions to keep B2C simple | Freeze Stripe checkout UX rules + pricing entities + Stripe mapping | — | `spec_pkg` | — | `["founder","system"]` | plan-start | `@flag:blocking` | `bg#FAEEDA:in-flight` | high |
| `S02` | `@node:n-actions` | `bg#E6F1FB:entitlements` | — | Create action taxonomy + entitlement rules | `spec_pkg` | `action_pkg` | `@edge:n-scope:spec_pkg→n-actions:spec_pkg` | `["system"]` | `spec_pkg` non-null | `@flag:contract-drift` | `bg#FBEAF0:backlog` | high |
| `S03` | `@node:n-mcp` | `bg#E6F1FB:MCP billing` | — | Implement MCP tools + Stripe adapter + idempotency | `action_pkg` | `service_pkg` | `@edge:n-actions:action_pkg→n-mcp:action_pkg` | `["system"]` | `action_pkg` non-null | `@flag:service-unavailable` | `bg#FBEAF0:backlog` | high |
| `S04` | `@node:n-ui` | `bg#FAEEDA:Stripe paywall` | Stripe checkout at Run/Export/Publish | MainPanel shows quote, opens Payment Link, refreshes entitlements | `service_pkg` | `ui_pkg` | `@edge:n-mcp:service_pkg→n-ui:service_pkg` | `["founder","system"]` | `service_pkg` non-null | `@flag:ux-incomplete` | `bg#FBEAF0:backlog` | medium |
| `S05` | `@node:n-ops` | `bg#EAF3DE:economics` | — | Quote before compute; cache; enforce free-tier; measure token costs | `ui_pkg` | `ops_pkg` | `@edge:n-ui:ui_pkg→n-ops:ui_pkg` | `["system"]` | `ui_pkg` non-null | `@flag:tco-risk` | `bg#FBEAF0:backlog` | medium |
| `S06` | `@node:n-deploy` | `bg#EAF3DE:ship` | Verify checkout on `{{cloudflare_host}}` | Deploy + Stripe webhooks + OpenClaw registry | `ops_pkg` | deployed surface | `@edge:n-ops:ops_pkg→n-deploy:ops_pkg` | `["system"]` | `ops_pkg` non-null | `@flag:deploy-failed` | `bg#FBEAF0:backlog` | medium |

---

## PRD — Product Requirements

### Problem

B2C creators want to generate and iterate video workflows quickly, but paywalls are often disconnected from intent, and pricing is opaque. The product needs commerce-like conversion: **monetize actions at the moment of intent** (Run/Export/Publish) with a low-friction Stripe checkout, while preserving FOSS, free-tier, and predictable token economics.

### B2C monetization ideas (recommended set)

| Monetized action | Why users pay | Meter | Default free-tier | Notes |
|---|---|---|---|---|
| Run VideoGeneration | unlock longer or higher quality runs | credits per run | `{{economics.free_tier_gens_daily}}` runs/day | quote before compute |
| Export bundle | shareable workflow artifacts | per export | 3 exports/day | can be bundled in subscription |
| Publish template | sell workflow templates | revenue share | 0 paid listings | commerce-like conversion |
| Asset hosting | keep outputs online | storage ops | 7-day TTL | upgrade extends TTL |
| Priority queue | reduce waiting | subscription add-on | none | separate from compute |

### ACP alignment (Agentic Commerce Protocol)

Agentic Commerce Protocol (ACP) is an open standard for sharing structured catalog data so assistants can surface products in context. For Knowgrph, treat **plans, credit packs, and template marketplace items** as a catalog with clear variants, stable IDs, and attribution-ready URLs.

#### Integration path (ACP-inspired)

| Step | Mode | Rationale | Fit for Knowgrph |
|---|---|---|---|
| 1 | Snapshot feed (daily) | stable baseline catalog | publish plans, packs, featured templates |
| 2 | API upserts (throughout day) | keep inventory current | update template availability, price changes |
| 3 | Promotions via API only | promo is time-bound | limited-time credit bonuses |

#### Catalog modeling rules (ACP-inspired)

| Rule | Why it matters | How Knowgrph applies |
|---|---|---|
| Variants at row level | variant-specific price/availability | `credit_pack_small` vs `credit_pack_large`; template tier variants |
| Factual descriptions | improves ranking and trust | short, literal copy: what user gets, constraints, refund rules |
| Optional fields only when stable | avoid brittle transforms | add markdown/HTML descriptions later |
| URLs must be valid + encoded | prevents broken checkout | pre-encode query params and asset URLs |
| Attribution params | measure conversion | add UTM-style parameters to checkout and template URLs |

### Goals

| id | Goal | maps to | Priority | Status |
|---|---|---|---|---|
| `G-01` | Monetize actions at intent moments in MainPanel via Stripe Checkout | `@node:n-ui` | `#D85A30:P0` | TBD |
| `G-02` | Stripe-backed MCP tools for quote + checkout + entitlements | `@node:n-mcp` | `#D85A30:P0` | TBD |
| `G-03` | Token economics: quote first, clamp, cache, no double charge (`{{economics.no_double_charge}}`) | `@node:n-ops` | `#D85A30:P0` | TBD |
| `G-04` | Free-tier remains usable: `{{economics.free_tier_credits_daily}}` credits/day | `@node:n-actions` | `#185FA5|bg#E6F1FB:P1` | TBD |
| `G-05` | OpenClaw-friendly tool names and stable schemas | `@node:n-mcp` | `#185FA5|bg#E6F1FB:P1` | TBD |

### Non-Goals

This does not require changing core editor code paths outside the billing surface; it is a shared service that the UI can call without embedding payment logic everywhere.

---

## `bg#E1F5EE:UF` User Flow (Stripe checkout)

1. User clicks **Run** on a VideoGeneration node.
2. UI calls `{{mcp.tool_quote}}` with run params and receives a price in `{{economics.paid_unit}}`.
3. If free-tier available, UI shows “use free credits”; otherwise UI opens a Stripe-hosted checkout (prefer Payment Link).
4. Default path: UI uses `{{mcp.tool_payment_link_get}}` and opens the hosted link (fastest ship).
5. Fallback path: service creates a new Checkout Session for each attempt via `{{mcp.tool_checkout_create}}` and redirects to `session.url`.
6. After payment, service reconciles using `{{mcp.tool_checkout_session_get}}` and checks `status` and `payment_status`, then updates entitlements.
7. UI calls `{{mcp.tool_entitlements}}`, then re-enables Run.

---

## `bg#E6F1FB:WF` Work Flow (service responsibilities)

### Core idea: monetize user actions, not time

| Action category | Trigger | Meter key | Outcome |
|---|---|---|---|
| compute | run workflow node | `video.run` | consumes credits and records usage |
| conversion | Stripe checkout | `billing.checkout` | creates paid entitlement |
| commerce | publish template | `market.listing` | enables marketplace listing |
| upsell | export bundle | `workflow.export` | converts share intent into payment |

### ACP-inspired catalog responsibilities

| Responsibility | Contract | Owner | Notes |
|---|---|---|---|
| Catalog snapshot generation | deterministic export of pricing + items | service | can be used for external channels later |
| Catalog updates (upsert) | idempotent updates keyed by stable ids | service | align with `{{economics.cache_ttl_days}}` caching |
| Attribution hygiene | stable tracking params | UI + service | use consistent parameter names |

### MCP tool contract (minimal set)

| Tool | Purpose | Inputs | Outputs |
|---|---|---|---|
| `{{mcp.tool_pricing_get}}` | show plans + packs | userId | plans, packs |
| `{{mcp.tool_quote}}` | quote before compute | params | credits, USD |
| `{{mcp.tool_payment_link_get}}` | fetch Stripe Payment Link | sku, userId | url, attribution_params |
| `{{mcp.tool_payment_link_create}}` | create/manage link (optional) | sku, price | url, active |
| `{{mcp.tool_checkout_create}}` | create Checkout Session (fallback) | quote, userId, mode | sessionId, url |
| `{{mcp.tool_checkout_status}}` | poll completion (legacy alias) | sessionId | status, payment_status |
| `{{mcp.tool_checkout_session_get}}` | retrieve session | sessionId | status, payment_status, customer, payment_intent, subscription |
| `{{mcp.tool_checkout_session_line_items}}` | retrieve line items | sessionId | line_items[] |
| `{{mcp.tool_checkout_session_expire}}` | expire session | sessionId | status=expired |
| `{{mcp.tool_usage_meter}}` | record usage | action, quantity | ok |
| `{{mcp.tool_entitlements}}` | entitlements snapshot | userId | caps, balances |

### Stripe Payment Links (preferred) — why

| Capability | Benefit | Implication for Knowgrph |
|---|---|---|
| Stripe-hosted payment page | faster shipping, less UI code | MainPanel opens a hosted URL |
| Preferred language + local currency | higher conversion globally | keep catalog prices compatible with localization |
| Many payment methods | broader coverage | rely on Stripe’s dynamic selection |
| Automatic receipts + dashboard refunds | support cost reduction | refund policy can be handled in Stripe UI |
| Link tracking via URL parameters | measure conversion | enforce attribution params consistency |
| Buy button + QR code | distribution | enable landing pages and social sharing |

### Stripe Checkout Sessions API (fallback) — why and how

Checkout Sessions provide a server-created payment attempt object with a hosted redirect URL (`session.url`). Recommendation: create a new session each time the customer attempts to pay, and reconcile on the server after completion.

| Session field | Why it matters | How Knowgrph uses it |
|---|---|---|
| `client_reference_id` | link to internal user/cart | set to `userId` or `docId` |
| `metadata` | structured reconciliation | include `sku`, `quote_hash`, `doc_id` |
| `mode` | one-time vs subscription | `payment` for packs, `subscription` for plans |
| `status` | open/complete/expired | guard fulfillment and retries |
| `payment_status` | paid/unpaid/no_payment_required | unlock entitlements only when `paid` |
| `customer` / `payment_intent` / `subscription` | canonical references after payment | store for audit, refunds, chargebacks |

---

## `bg#EAF3DE:DF` Data Flow (pricing, entitlements, usage)

### Data lifecycle

| Entity | Created at | Updated at | Deleted/expired | Notes |
|---|---|---|---|---|
| pricing | admin publish | on price change | versioned | show in UI instantly |
| payment_links | dashboard create or API create | when sku changes | versioned | stable mapping: sku → url |
| checkout_sessions | session create (per attempt) | status transitions | expired | reconcile by `status` + `payment_status` |
| entitlements | signup + checkout | webhook + consumption | never hard delete | clamp at service boundary |
| usage_ledger | per action | aggregation | retained | audit + refunds |
| catalog_items | pricing publish + template publish | on update | versioned | ACP-inspired: items + variants |

### Suggested schema (SSOT)

```sql
CREATE TABLE pricing (
  id            TEXT PRIMARY KEY,
  kind          TEXT CHECK (kind IN ('subscription','pack','addon')) NOT NULL,
  sku           TEXT NOT NULL,
  unit          TEXT NOT NULL,
  price_usd     NUMERIC NOT NULL,
  credits       NUMERIC,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payment_links (
  id            TEXT PRIMARY KEY,
  sku           TEXT NOT NULL,
  url           TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checkout_sessions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT,
  doc_id              TEXT,
  sku                 TEXT,
  mode                TEXT,
  status              TEXT,
  payment_status      TEXT,
  customer_id         TEXT,
  payment_intent_id   TEXT,
  subscription_id     TEXT,
  url                 TEXT,
  client_reference_id TEXT,
  metadata_json       TEXT,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE catalog_items (
  id            TEXT PRIMARY KEY,
  kind          TEXT CHECK (kind IN ('plan','pack','template','addon')) NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  url           TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE catalog_variants (
  id            TEXT PRIMARY KEY,
  parent_id     TEXT REFERENCES catalog_items(id),
  title         TEXT NOT NULL,
  price_usd     NUMERIC NOT NULL,
  credits       NUMERIC,
  availability  TEXT,
  variant_options_json TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entitlements (
  user_id         TEXT PRIMARY KEY,
  plan            TEXT,
  credits_balance NUMERIC DEFAULT 0,
  credits_daily   NUMERIC DEFAULT 0,
  free_gens_daily NUMERIC DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usage_ledger (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  action_key      TEXT NOT NULL,
  quantity        NUMERIC NOT NULL,
  unit            TEXT NOT NULL,
  quote_hash      TEXT,
  stripe_event_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON usage_ledger (user_id, created_at);
CREATE INDEX ON usage_ledger (action_key, created_at);
CREATE INDEX ON payment_links (sku, active);
CREATE INDEX ON checkout_sessions (user_id, created_at);
CREATE INDEX ON checkout_sessions (sku, created_at);
CREATE INDEX ON catalog_items (kind, active);
CREATE INDEX ON catalog_variants (parent_id);
```

---

## Go/No-Go decision table (weighted)

Scoring scale: 1–5 (higher = better). For “TCO risk”, higher score means lower risk.

| Option | Tech readiness (0.30) | Differentiation (0.30) | ICP clarity (0.20) | TCO risk (0.20) | Weighted total | Go/No-Go |
|---|---:|---:|---:|---:|---:|---|
| A · Stripe Payment Links + MCP billing (recommended) | 5 | 4 | 4 | 5 | 4.6 | Go |
| B · Custom Stripe Checkout Sessions only (more code) | 4 | 4 | 4 | 3 | 3.9 | No-Go |
| C · Subscription-only (no pay-per-use) | 5 | 2 | 3 | 3 | 3.3 | No-Go |
| D · Paywall outside editor (no intent moment) | 4 | 2 | 2 | 3 | 2.9 | No-Go |
| E · ACP-only channel (ChatGPT merchant feed) | 2 | 3 | 2 | 3 | 2.6 | No-Go |

---

## Top 3 experiments (next 2 weeks) to validate PMF quickly

| Experiment | Hypothesis | Success metric | Timebox | Owner |
|---|---|---|---|---|
| E1 · Stripe checkout at Run moment | Intent-moment checkout increases conversion | ≥3% checkout conversion from paywalled Run | 4 days | `{{owner}}` |
| E2 · Payment Links vs Checkout Session A/B | Payment Links reduce friction with no conversion loss | ≥15% higher completion rate, or same completion with faster ship | 4 days | `{{owner}}` |
| E3 · Attribution params + URL tracking | Consistent URL parameters improve funnel measurability | attribution present on ≥95% Payment Link URLs; dashboard tracking matches | 1 week | `{{owner}}` |

---

## References (commerce protocol)

- OpenAI Commerce / Agentic Commerce Protocol: https://developers.openai.com/commerce
- Stripe Payment Links: https://docs.stripe.com/payment-links
- Stripe Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions

---

## Open Questions

| id | Question | Owner | Due | Status |
|---|---|---|---|---|
| `OQ-01` | What are the first 2 monetized actions that maximize value and minimize UX friction? | `{{owner}}` | TBD | `#D85A30:blocking` |
| `OQ-02` | What is the canonical unit for usage metering: `{{economics.paid_unit}}` only, or add `runs`? | `{{owner}}` | TBD | `#D85A30:blocking` |
| `OQ-03` | How is `quote_hash` computed to guarantee `{{economics.no_double_charge}}`? | `{{owner}}` | TBD | medium |
| `OQ-04` | Free-tier caps: confirm `{{economics.free_tier_credits_daily}}` and `{{economics.free_tier_gens_daily}}` | `{{owner}}` | TBD | medium |
| `OQ-05` | Should MainPanel default to Payment Links (hosted) for packs/subscriptions, and reserve Checkout Sessions for edge cases? | `{{owner}}` | TBD | `#D85A30:blocking` |
