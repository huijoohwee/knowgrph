# knowgrph-stripe-mcp-service - Companion

Continuation from knowgrph-stripe-mcp-service.md. This appendix keeps the data, decision, experiment, and reference material neutral so Stripe MCP readiness can be reused across payment workflows without fixed product or price fixtures.

## `bg#EAF3DE:DF` Data Flow

### Data Lifecycle

| Entity | Created At | Updated At | Deleted/Expired | Notes |
|---|---|---|---|---|
| `stripe_mcp_config` | shared defaults or operator edit | when server key/URL/mode changes | never hard delete | non-secret connection metadata |
| `stripe_mcp_local_template` | shared defaults | when launcher package changes | versioned | contains only env placeholders |
| `stripe_mcp_tool_policy` | shared defaults | when Stripe MCP exposes new payment-capable tools | versioned | maps tool name to confirmation/scope policy |
| `payment_readiness_audit` | MainPanel MCP render or config export | on each readiness review | retained by trace policy | no raw secrets |
| `payment_handoff_state` | operator opens Payments from MCP | on checkout/entitlement setup | product policy | owned by Payments surface |

### Suggested Schema

```sql
CREATE TABLE stripe_mcp_config (
  id                 TEXT PRIMARY KEY,
  server_key         TEXT NOT NULL,
  remote_url         TEXT NOT NULL,
  connection_mode    TEXT CHECK (connection_mode IN ('oauth','bearer')) NOT NULL,
  startup_timeout_ms INTEGER NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stripe_mcp_tool_policy (
  tool_name             TEXT PRIMARY KEY,
  mutation_class        TEXT CHECK (mutation_class IN ('read','create','update','delete','money_movement')) NOT NULL,
  requires_confirmation BOOLEAN NOT NULL DEFAULT true,
  required_scope_note   TEXT NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payment_readiness_audit (
  id             TEXT PRIMARY KEY,
  principal_id   TEXT,
  config_id      TEXT REFERENCES stripe_mcp_config(id),
  tool_name      TEXT,
  args_hash      TEXT,
  result_status  TEXT NOT NULL,
  trace_id       TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON payment_readiness_audit (principal_id, created_at);
CREATE INDEX ON payment_readiness_audit (trace_id);
```

The schema is intentionally optional. It describes a backend audit shape if payment readiness becomes persistent; the browser UI still stores only non-secret configuration values.

---

## Go/No-Go Decision Table

Scoring scale: 1-5. For security and TCO, higher means lower risk.

| Option | Readiness | Security | TCO | Reuse | Weighted Total | Decision |
|---|---:|---:|---:|---:|---:|---|
| A - Remote Stripe MCP with OAuth | 5 | 5 | 5 | 5 | 5.0 | Go |
| B - Local `@stripe/mcp@latest` with env secret | 5 | 4 | 4 | 4 | 4.3 | Go as fallback |
| C - Remote bearer restricted key | 4 | 3 | 4 | 4 | 3.7 | Conditional |
| D - Browser-stored Stripe key | 1 | 1 | 2 | 1 | 1.2 | No-Go |
| E - Custom Stripe wrapper before using official MCP | 2 | 3 | 2 | 2 | 2.2 | No-Go |

---

## Validation Experiments

| Experiment | Hypothesis | Success Metric | Owner |
|---|---|---|---|
| E1 - MainPanel MCP render proof | Shared Stripe MCP defaults render without duplicated strings | Render test includes remote URL, registry URL, local launcher, env placeholder, and tool list | Maintainer |
| E2 - Secret-boundary scan | Docs and UI fixtures avoid real Stripe key prefixes | Secret-key and restricted-key literals do not appear in Stripe MCP surfaces | Maintainer |
| E3 - Confirmation gate smoke | Payment-mutating tools cannot run implicitly | Calls to create/refund/invoice/payment-link tools require explicit confirmation | Operator |
| E4 - Commerce handoff | MCP readiness does not duplicate checkout UX | MainPanel MCP links to Commerce; checkout/entitlements stay owned by Commerce | Maintainer |

---

## References

- Stripe MCP documentation: https://docs.stripe.com/mcp
- Stripe MCP registry entry: https://github.com/mcp/com.stripe/mcp
- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization

---

## Open Questions

| id | Question | Owner | Due | Status |
|---|---|---|---|---|
| `OQ-01` | Which agent host will be the first OAuth-capable Stripe MCP runtime? | `{{owner}}` | TBD | blocking |
| `OQ-02` | Which exact restricted-key permissions are required for the first payment workflow? | `{{owner}}` | TBD | blocking |
| `OQ-03` | Should backend audit persistence be added now or deferred until live checkout is enabled? | `{{owner}}` | TBD | medium |
| `OQ-04` | Which Commerce handoff should be first: checkout setup, entitlement view, or webhook readiness? | `{{owner}}` | TBD | medium |
