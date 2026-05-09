---
title: Knowgrph · WeChat Mini Program + WeChat Pay MCP Service — B2C Monetization (Image + Video Flow Editor)
graphId: md:knowgrph-wechat-mini-program
product: "Knowgrph Canvas"
service_type: "AI-native · MCP-based · OpenClaw-friendly · FOSS-first · token-economics-first"
doc_type: "Recommendation (PRD + TAD aligned)"
version: "0.1.0"
owner: "joohwee"
status: "draft"
date: "2026-04-22"
license: "FOSS"
tier: "free + pay-per-use + subscription"
ai_model: "provider-swappable"

dev_repo: "${KG_GITHUB_ROOT}/knowgrph"
prod_repo: "${KG_GITHUB_ROOT}/huijoohwee/knowgrph"
cloudflare_host: "airvio.co/knowgrph"

mini_program_platform: "WeChat Mini Program"
mini_program_sdk: "CloudBase Mini Program SDK (built-in runtime)"
mini_program_sdk_docs: "https://www.tencentcloud.com/document/product/1266/74518"

payment_platform: "WeChat Pay"
wechat_pay_mini_program_docs: "https://pay.weixin.qq.com/doc/global/v3/en/4012357207"
wechat_pay_jsapi_docs: "https://pay.weixin.qq.com/doc/global/v3/en/4012357205"

provider_registry: "OpenClaw"
primary_use_case: "Image + Video Generation Flow Editor Service"
icp: "solo creators + small studios in WeChat ecosystem"

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
  server_url:              {key: server_url,              type: string, value: "mcp://localhost:3130"}
  tool_pricing_get:        {key: tool_pricing_get,        type: string, value: "billing_pricing_get"}
  tool_quote:              {key: tool_quote,              type: string, value: "billing_quote"}
  tool_wechatpay_prepay:   {key: tool_wechatpay_prepay,   type: string, value: "billing_wechatpay_prepay_create"}
  tool_wechatpay_status:   {key: tool_wechatpay_status,   type: string, value: "billing_wechatpay_order_status"}
  tool_entitlements_get:   {key: tool_entitlements_get,   type: string, value: "billing_entitlements_get"}
  tool_usage_meter:        {key: tool_usage_meter,        type: string, value: "billing_usage_meter"}
  tool_catalog_export:     {key: tool_catalog_export,     type: string, value: "billing_catalog_export"}
  timeout_s:               {key: timeout_s,               type: number, value: 15}
  auth:                    {key: auth,                    type: string, value: "bearer-token (optional)"}

# ── economics ─────────────────────────────────────────────────────────────────
# Token performance/economics are first-class: quote and clamp BEFORE compute.
economics:
  token_budget_context:      {key: token_budget_context,      type: number, value: 1024}
  token_budget_response:     {key: token_budget_response,     type: number, value: 1536}
  mcp_tax_tokens:            {key: mcp_tax_tokens,            type: number, value: 150}
  free_tier_credits_daily:   {key: free_tier_credits_daily,   type: number, value: 50}
  free_tier_gens_daily:      {key: free_tier_gens_daily,      type: number, value: 3}
  paid_unit:                 {key: paid_unit,                 type: string, value: "compute_credits"}
  price_per_credit_cny:      {key: price_per_credit_cny,      type: number, value: 0.15}
  subscription_monthly_cny:  {key: subscription_monthly_cny,  type: number, value: 88}
  cache_ttl_days:            {key: cache_ttl_days,            type: number, value: 30}
  no_double_charge:          {key: no_double_charge,          type: boolean, value: true}
  quote_basis:               {key: quote_basis,               type: string, value: "duration_s × res_factor × fps_factor × model_factor"}

# ── pipeline ──────────────────────────────────────────────────────────────────
# This plan is a delivery pipeline (implementation steps), not the runtime DAG.
# pipeline[*].node MUST match flow.nodes[*].id AND mermaid node IDs exactly.
pipeline:
  - seq: S01
    node: n-scope
    label: "scope lock + WeChat surface definition"
    actor: ["founder","system"]
    edge_in: "—"
    edge_out: spec_pkg
    user_action: "Confirm first 2 monetized actions in WeChat: run generation, export/share result"
    sys_event: "Freeze SSOT: WeChat Mini Program capabilities, WeChat Pay order flow, free-tier clamps"
    data_in: "—"
    data_out: "spec_pkg {monetized_actions, pricing_model, entitlements, free_tier_policy, mp_constraints}"
    trigger: plan-start
    on_fail: "@flag:blocking — unclear surface causes churn"
    kanban: in-flight
    confidence: high
    status: TBD

  - seq: S02
    node: n-mini
    label: "Mini Program container + MainPanel integration"
    actor: ["system"]
    edge_in: spec_pkg
    edge_out: mp_pkg
    user_action: "—"
    sys_event: "Define Mini Program UI entry: MainPanel sheet + paywall triggers; confirm runtime/base library constraints"
    data_in: "spec_pkg"
    data_out: "mp_pkg {ui_routes, panel_sheet, paywall_triggers, sdk_version_min}"
    trigger: spec_pkg non-null
    on_fail: "@flag:ux-incomplete — cannot ship inside Mini Program"
    kanban: backlog
    confidence: high
    status: TBD

  - seq: S03
    node: n-pay
    label: "WeChat Pay prepay + entitlements ledger"
    actor: ["system"]
    edge_in: mp_pkg
    edge_out: pay_pkg
    user_action: "—"
    sys_event: "Implement WeChat Pay order placement to generate prepay payload; persist entitlements and usage"
    data_in: "mp_pkg"
    data_out: "pay_pkg {prepay_payload, webhook_handlers, entitlements_ledger}"
    trigger: mp_pkg non-null
    on_fail: "@flag:service-unavailable — payments cannot complete"
    kanban: backlog
    confidence: medium
    status: TBD

  - seq: S04
    node: n-mcp
    label: "MCP service boundary (OpenClaw-friendly)"
    actor: ["system"]
    edge_in: pay_pkg
    edge_out: service_pkg
    user_action: "—"
    sys_event: "Expose MCP tools for pricing, quote, prepay create, status, entitlements, usage meter; add caching + idempotency"
    data_in: "pay_pkg"
    data_out: "service_pkg {mcp_tools, allowlist, idempotency_policy}"
    trigger: pay_pkg non-null
    on_fail: "@flag:contract-drift — tool names drift breaks OpenClaw"
    kanban: backlog
    confidence: high
    status: TBD

  - seq: S05
    node: n-econ
    label: "token economics + TCO guardrails"
    actor: ["system"]
    edge_in: service_pkg
    edge_out: ops_pkg
    user_action: "—"
    sys_event: "Quote-before-compute; cache by param hash; enforce free-tier; record token/cost metrics"
    data_in: "service_pkg"
    data_out: "ops_pkg {cache_keys, quota_enforcer, cost_metrics, refund_policy}"
    trigger: service_pkg non-null
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
    user_action: "Verify Mini Program paywall + unlock works; verify generation starts after payment"
    sys_event: "Publish docs; register OpenClaw entry; deploy control-plane surfaces on {{cloudflare_host}}"
    data_in: "ops_pkg"
    data_out: "deployed WeChat Mini Program monetization surface"
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

    User(["WeChat creator"])
    MiniProgram[/"WeChat Mini Program\nMainPanel sheet"/]
    WeChatPay[/"WeChat Pay"/]
    DB[("entitlements\nusage_ledger\npricing")]
    OpenClaw[/"OpenClaw registry"/]
    GenSvc[/"Image + Video Gen Service"/]

    subgraph P1["S01–S02 · Define"]
      n-scope["S01 · n-scope\nWeChat surface"]
      n-mini["S02 · n-mini\nMini Program UI"]
      n-scope --> n-mini
    end

    subgraph P2["S03–S05 · Build"]
      n-pay["S03 · n-pay\nWeChat Pay prepay"]
      n-mcp["S04 · n-mcp\nMCP tools boundary"]
      n-econ["S05 · n-econ\neconomics guardrails"]
      n-mini --> n-pay --> n-mcp --> n-econ
    end

    subgraph P3["S06 · Ship"]
      n-deploy["S06 · n-deploy\nDev → Prod → Cloudflare"]
      n-econ --> n-deploy
    end

    User -->|intent| MiniProgram
    MiniProgram -->|invoke pay| WeChatPay
    n-pay -->|write| DB
    GenSvc -->|preflight quote| n-mcp
    n-deploy -->|register tools| OpenClaw

    class User persona
    class MiniProgram process
    class GenSvc process
    class n-scope,n-mini,n-pay,n-mcp,n-econ process
    class n-deploy output
    class WeChatPay bill
    class DB store
    class OpenClaw process

    click n-scope "#pipeline--from-0-to-1" "S01 · scope lock"
    click n-mini "#pipeline--from-0-to-1" "S02 · mini program"
    click n-pay "#pipeline--from-0-to-1" "S03 · wechat pay"
    click n-mcp "#pipeline--from-0-to-1" "S04 · mcp boundary"
    click n-econ "#pipeline--from-0-to-1" "S05 · economics"
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
      label:         {key: label,         type: string,   value: "S01 · defineWeChatMonetizedActions()"}
      phase:         {key: phase,         type: string,   value: "define"}
      actor:         {key: actor,         type: array,    value: ["founder","system"]}
      handles:       {key: handles,       type: object,   value: {source: ["spec_pkg"]}}
      data:          {key: data,          type: object,   value: {use_case: "image+video flow editor", surface: "mini program", pay: "wechat pay"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-06","V-07"]}
      db_writes:     {key: db_writes,     type: string,   value: "pricing"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "in-flight"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ spec_pkg: inputs.__seed ? { ok: true } : { ok: true } })
      }

    - id:            {key: id,            type: string,   value: "n-mini"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S02 · defineMiniProgramMainPanel()"}
      phase:         {key: phase,         type: string,   value: "integrate"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["spec_pkg"], source: ["mp_pkg"]}}
      data:          {key: data,          type: object,   value: {sdk: "CloudBase built-in", base_library_min: "2.2.3"}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03"]}
      db_writes:     {key: db_writes,     type: string,   value: "—"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ mp_pkg: inputs.spec_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-pay"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S03 · implementWeChatPayPrepay()"}
      phase:         {key: phase,         type: string,   value: "billing"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["mp_pkg"], source: ["pay_pkg"]}}
      data:          {key: data,          type: object,   value: {flow: "prepay → requestPayment → order status", requires_openid: true}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03"]}
      db_writes:     {key: db_writes,     type: string,   value: "entitlements, usage_ledger"}
      retry_arc:     {key: retry_arc,     type: string,   value: "source"}
      confidence:    {key: confidence,    type: string,   value: "medium"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ pay_pkg: inputs.mp_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-mcp"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S04 · serveWeChatBillingTools()"}
      phase:         {key: phase,         type: string,   value: "build"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["pay_pkg"], source: ["service_pkg"]}}
      data:          {key: data,          type: object,   value: {tools: ["billing_pricing_get","billing_quote","billing_wechatpay_prepay_create","billing_wechatpay_order_status","billing_entitlements_get","billing_usage_meter","billing_catalog_export"], openclaw: true}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-01","V-03","V-05","V-07"]}
      db_writes:     {key: db_writes,     type: string,   value: "usage_ledger"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "high"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ service_pkg: inputs.pay_pkg ? { ok: true, server_url: "mcp://localhost:3130" } : null })
      }

    - id:            {key: id,            type: string,   value: "n-econ"}
      type:          {key: type,          type: string,   value: "default"}
      label:         {key: label,         type: string,   value: "S05 · enforceWeChatEconomicsGuards()"}
      phase:         {key: phase,         type: string,   value: "optimize"}
      actor:         {key: actor,         type: array,    value: ["system"]}
      handles:       {key: handles,       type: object,   value: {target: ["service_pkg"], source: ["ops_pkg"]}}
      data:          {key: data,          type: object,   value: {quote_before_compute: true, cache: true, no_double_charge: true}}
      applies_rules: {key: applies_rules, type: array,    value: ["V-03","V-05"]}
      db_writes:     {key: db_writes,     type: string,   value: "usage_ledger"}
      retry_arc:     {key: retry_arc,     type: string,   value: "—"}
      confidence:    {key: confidence,    type: string,   value: "medium"}
      status:        {key: status,        type: string,   value: "TBD"}
      kanban:        {key: kanban,        type: string,   value: "backlog"}
      compute:       {key: compute,       type: function, value: |
        (inputs) => ({ ops_pkg: inputs.service_pkg ? { ok: true } : null })
      }

    - id:            {key: id,            type: string,   value: "n-deploy"}
      type:          {key: type,          type: string,   value: "output"}
      label:         {key: label,         type: string,   value: "S06 · deployWeChatSurface()"}
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
    - {id: e1, source: n-scope, sourceHandle: spec_pkg,    target: n-mini, sourceHandle: spec_pkg, animated: true}
    - {id: e2, source: n-mini,  sourceHandle: mp_pkg,      target: n-pay,  targetHandle: mp_pkg,   animated: true}
    - {id: e3, source: n-pay,   sourceHandle: pay_pkg,     target: n-mcp,  targetHandle: pay_pkg,  animated: true}
    - {id: e4, source: n-mcp,   sourceHandle: service_pkg, target: n-econ, targetHandle: service_pkg, animated: true}
    - {id: e5, source: n-econ,  sourceHandle: ops_pkg,     target: n-deploy, targetHandle: ops_pkg, animated: true}
---

# Knowgrph · WeChat Mini Program + WeChat Pay MCP Service — B2C Monetization (Image + Video Flow Editor)

`bg#E1F5EE:version {{version}}` · `bg#FAEEDA:status {{status}}` · owner `{{owner}}` · {{date}} · `bg#EAF3DE:{{license}}` · tier `{{tier}}`

> This document recommends a WeChat-native B2C monetization path by embedding the MainPanel commerce surface inside a **WeChat Mini Program**, and completing checkout with **WeChat Pay**. YAML frontmatter is the machine-readable SSOT (`mermaid:`, `flow:`, `pipeline:`); the body is the human-readable projection, organized by **From 0 to 1** and the three lenses: `bg#E1F5EE:UF` user flow, `bg#E6F1FB:WF` work flow, `bg#EAF3DE:DF` data flow.

---

## Flow Graph

```mermaid
{{mermaid}}
```

### Frontmatter → body linkage map

| Frontmatter key | Resolves in body as | Example |
|---|---|---|
| `mini_program_sdk_docs` | URL reference | `{{mini_program_sdk_docs}}` |
| `wechat_pay_mini_program_docs` | URL reference | `{{wechat_pay_mini_program_docs}}` |
| `mcp.tool_wechatpay_prepay` | tool name | call `{{mcp.tool_wechatpay_prepay}}` |
| `economics.free_tier_gens_daily` | numeric cap | cap `{{economics.free_tier_gens_daily}}` |
| `flow.edges[*]` | edge sigil | `@edge:n-pay:pay_pkg→n-mcp:pay_pkg` |

---

## Pipeline — From 0 to 1

Human-readable projection of `pipeline:` frontmatter. Column header sigils encode perspective: `bg#E1F5EE:UF` user flow, `bg#E6F1FB:WF` work flow, `bg#EAF3DE:DF` data flow.

| seq | `@node:id` | pipeline step | `bg#E1F5EE:UF` user action | `bg#E6F1FB:WF` system event | `bg#EAF3DE:DF` data in | `bg#EAF3DE:DF` data out | edge | actor | trigger | on fail | kanban | confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `S01` | `@node:n-scope` | `bg#E6F1FB:define WeChat surface` | Confirm 2 monetized actions | Freeze Mini Program + Pay constraints + free-tier clamps | — | `spec_pkg` | — | `["founder","system"]` | plan-start | `@flag:blocking` | `bg#FAEEDA:in-flight` | high |
| `S02` | `@node:n-mini` | `bg#E6F1FB:Mini Program UI` | — | MainPanel sheet + paywall triggers; confirm base library min | `spec_pkg` | `mp_pkg` | `@edge:n-scope:spec_pkg→n-mini:spec_pkg` | `["system"]` | `spec_pkg` non-null | `@flag:ux-incomplete` | `bg#FBEAF0:backlog` | high |
| `S03` | `@node:n-pay` | `bg#FAEEDA:WeChat Pay prepay` | — | Create prepay payload; persist entitlements and usage | `mp_pkg` | `pay_pkg` | `@edge:n-mini:mp_pkg→n-pay:mp_pkg` | `["system"]` | `mp_pkg` non-null | `@flag:service-unavailable` | `bg#FBEAF0:backlog` | medium |
| `S04` | `@node:n-mcp` | `bg#E6F1FB:MCP billing boundary` | — | Expose stable MCP tool contracts (OpenClaw-friendly) | `pay_pkg` | `service_pkg` | `@edge:n-pay:pay_pkg→n-mcp:pay_pkg` | `["system"]` | `pay_pkg` non-null | `@flag:contract-drift` | `bg#FBEAF0:backlog` | high |
| `S05` | `@node:n-econ` | `bg#EAF3DE:economics` | — | Quote-before-compute; cache; enforce free-tier; metrics | `service_pkg` | `ops_pkg` | `@edge:n-mcp:service_pkg→n-econ:service_pkg` | `["system"]` | `service_pkg` non-null | `@flag:tco-risk` | `bg#FBEAF0:backlog` | medium |
| `S06` | `@node:n-deploy` | `bg#EAF3DE:ship` | Verify paywall→unlock→generate | Register OpenClaw; publish docs; deploy on `{{cloudflare_host}}` | `ops_pkg` | deployed | `@edge:n-econ:ops_pkg→n-deploy:ops_pkg` | `["system"]` | `ops_pkg` non-null | `@flag:deploy-failed` | `bg#FBEAF0:backlog` | medium |

---

## PRD — Product Requirements

### Problem

Creators inside WeChat want “generate now” loops with low friction, local payments, and clear value. A web-only checkout often breaks the flow. The goal is to monetize **actions at intent moments** inside the Mini Program, while maintaining predictable token economics and low TCO.

### B2C monetization ideas (recommended set)

| Monetized action | Why users pay | Meter | Default free-tier | Notes |
|---|---|---|---|---|
| Run generation (image/video) | unlock longer, higher quality, more runs | credits per run | `{{economics.free_tier_gens_daily}}` runs/day | quote before compute |
| Export/share result | convert “share intent” into payment | per export | 3 exports/day | template share is viral |
| Template marketplace | creators sell workflows | revenue share | none | commerce-like conversion |
| Asset hosting | keep outputs online longer | storage tier | 7-day TTL | upgrade extends TTL |
| Subscription | remove friction | monthly | `{{economics.free_tier_credits_daily}}` credits/day | bundles exports + hosting |

### Goals

| id | Goal | maps to | Priority | Status |
|---|---|---|---|---|
| `G-01` | MainPanel commerce inside WeChat Mini Program | `@node:n-mini` | `#D85A30:P0` | TBD |
| `G-02` | WeChat Pay prepay + entitlement unlock works reliably | `@node:n-pay` | `#D85A30:P0` | TBD |
| `G-03` | MCP billing tools are stable (OpenClaw-friendly) | `@node:n-mcp` | `#D85A30:P0` | TBD |
| `G-04` | Token economics: quote first, clamp, cache, no double charge | `@node:n-econ` | `#D85A30:P0` | TBD |
| `G-05` | Free-tier remains usable without abuse | `@node:n-econ` | `#185FA5|bg#E6F1FB:P1` | TBD |

### Non-Goals

This does not require changing the existing codebase in this task. It defines a service recommendation and contracts for later implementation.

---

## `bg#E1F5EE:UF` User Flow (Mini Program + WeChat Pay)

1. User opens the Mini Program and selects a workflow.
2. User presses **Run** on an image/video node.
3. UI calls `{{mcp.tool_quote}}` and shows price in `{{economics.paid_unit}}`.
4. If insufficient credits, UI starts WeChat Pay and completes payment.
5. UI refreshes entitlements via `{{mcp.tool_entitlements_get}}`.
6. User re-presses Run and generation starts.

---

## `bg#E6F1FB:WF` Work Flow (service responsibilities)

### Mini Program constraints (practical)

| Constraint | Implication | Mitigation |
|---|---|---|
| SDK is built into runtime | minimal bundle size | avoid extra SDK dependencies |
| Base library version matters | features vary by tool version | set a minimum supported version |

### Payment flow shape (Mini Program Payment)

| Step | System action | Notes |
|---|---|---|
| preflight | quote + entitlement check | reject early if over cap |
| prepay | create an order + get prepay payload | service returns payload to Mini Program |
| client pay | Mini Program invokes payment UI | payment must start inside Mini Program |
| confirm | server checks order status + writes entitlements | final authority is server-side |

### MCP tool contract (minimal set)

| Tool | Purpose | Inputs | Outputs |
|---|---|---|---|
| `{{mcp.tool_pricing_get}}` | show plans + packs | userId | plans, packs |
| `{{mcp.tool_quote}}` | quote before compute | params | credits, CNY |
| `{{mcp.tool_wechatpay_prepay}}` | create prepay payload | sku, userId | prepay payload |
| `{{mcp.tool_wechatpay_status}}` | check order state | orderId | status |
| `{{mcp.tool_entitlements_get}}` | entitlements snapshot | userId | balances, caps |
| `{{mcp.tool_usage_meter}}` | record usage | action, quantity | ok |
| `{{mcp.tool_catalog_export}}` | export catalog | version | JSON |

---

## `bg#EAF3DE:DF` Data Flow (pricing, entitlements, usage)

### Data lifecycle

| Entity | Created at | Updated at | Deleted/expired | Notes |
|---|---|---|---|---|
| pricing | admin publish | on price change | versioned | source of truth for quotes |
| orders | prepay create | status updates | retained | idempotency required |
| entitlements | signup + payment | consumption | never hard delete | enforced at service boundary |
| usage_ledger | per action | aggregation | retained | audit + chargebacks |

### Suggested schema (SSOT)

```sql
CREATE TABLE pricing (
  id            TEXT PRIMARY KEY,
  kind          TEXT CHECK (kind IN ('subscription','pack','addon')) NOT NULL,
  sku           TEXT NOT NULL,
  unit          TEXT NOT NULL,
  price_cny     NUMERIC NOT NULL,
  credits       NUMERIC,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  sku             TEXT NOT NULL,
  amount_cny      NUMERIC NOT NULL,
  status          TEXT CHECK (status IN ('created','paying','paid','failed','refunded')) NOT NULL,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
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
  order_id        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON orders (user_id, created_at);
CREATE INDEX ON usage_ledger (user_id, created_at);
CREATE INDEX ON pricing (sku, active);
```

---

## Go/No-Go decision table (weighted)

Scoring scale: 1–5 (higher = better). For “TCO risk”, higher score means lower risk.

| Option | Tech readiness (0.30) | Differentiation (0.30) | ICP clarity (0.20) | TCO risk (0.20) | Weighted total | Go/No-Go |
|---|---:|---:|---:|---:|---:|---|
| A · WeChat Mini Program + WeChat Pay + MCP billing (recommended) | 4 | 4 | 4 | 4 | 4.0 | Go |
| B · Web-only checkout (outside WeChat) | 5 | 2 | 3 | 3 | 3.3 | No-Go |
| C · Subscription-only (no pay-per-use) | 5 | 2 | 2 | 3 | 3.2 | No-Go |

---

## Top 3 experiments (next 2 weeks) to validate PMF quickly

| Experiment | Hypothesis | Success metric | Timebox | Owner |
|---|---|---|---|---|
| E1 · WeChat paywall at Run moment | In-context payment improves conversion | ≥3% paid conversion among paywalled runs | 4 days | `{{owner}}` |
| E2 · Quote clarity A/B | Showing credits + CNY price reduces churn | ≥20% fewer cancels; stable completion | 4 days | `{{owner}}` |
| E3 · Template marketplace probe | Creator-to-creator commerce can emerge | ≥10 template listings; ≥5 purchases | 1 week | `{{owner}}` |

---

## References

- WeChat Mini Program SDK (CloudBase): {{mini_program_sdk_docs}}
- WeChat Pay Mini Program Payment: {{wechat_pay_mini_program_docs}}
- WeChat Pay JSAPI Payment (comparison): {{wechat_pay_jsapi_docs}}
