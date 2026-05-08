# knowgrph-stripe-mcp-service - Companion

Continuation from knowgrph-stripe-mcp-service.md.

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
