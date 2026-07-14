import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import {
  SME_GROWTH_TRIGGER_MAP,
  SME_MARKETPLACE_GATE_ID,
  evaluateSmeGrowthTriggers,
  matchSmeCoverageCategories,
  normalizeSmeCareSource,
} from "../sme-risk-copilot-runtime.js";

const check = (property) => fc.assert(property, { numRuns: 100 });
const declaredMilestones = SME_GROWTH_TRIGGER_MAP.map((rule) => rule.milestone);
const declaredIds = new Set(SME_GROWTH_TRIGGER_MAP.map((rule) => rule.id));
const safeText = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 3, maxLength: 30 });

test("Property: trigger evaluation never invents a rule id", () => check(fc.property(
  fc.array(fc.oneof(fc.constantFrom(...declaredMilestones), safeText), { maxLength: 30 }),
  (milestones) => {
    const result = evaluateSmeGrowthTriggers({ changes: milestones.map((milestone, index) => ({ element: "node", milestone, source_field: `signals[${index}]`, operation: "added" })) });
    assert.equal(result.ok, true);
    assert.ok(result.matched_rule_ids.every((id) => declaredIds.has(id)));
    assert.equal(new Set(result.matched_rule_ids).size, result.matched_rule_ids.length);
    assert.equal(result.cost_log.estimated_cost_usd, 0);
  },
)));

test("Property: unsafe source keys always fail before mutation and spend", () => check(fc.property(
  fc.constantFrom("bank_account", "registry_id", "api_key", "private_key", "credential"),
  safeText,
  (key, value) => {
    const result = normalizeSmeCareSource({ profile_id: "synthetic", industry: "services", size: 2, growth_stage: "pre_seed", [key]: value });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "unsafe_source");
    assert.equal(result.mutation_performed, false);
    assert.equal(result.cost_log.estimated_cost_usd, 0);
    assert.equal(JSON.stringify(result).includes(JSON.stringify(value)), false);
  },
)));

test("Property: marketplace matching permits only a valid single-use gate token", () => check(fc.property(
  fc.constantFrom("cyber", "supply_chain", "asset_physical"),
  fc.constantFrom("absent", "mismatched", "expired", "consumed", "unsigned", "valid"),
  (domain, state) => {
    const now = Date.UTC(2026, 6, 14, 6, 0, 0);
    const variants = {
      absent: null,
      mismatched: { gateId: "other", issuedAt: now, consumed: false, verified: true },
      expired: { gateId: SME_MARKETPLACE_GATE_ID, issuedAt: now - 900_001, consumed: false, verified: true },
      consumed: { gateId: SME_MARKETPLACE_GATE_ID, issuedAt: now, consumed: true, verified: true },
      unsigned: { gateId: SME_MARKETPLACE_GATE_ID, issuedAt: now, consumed: false, verified: false },
      valid: { gateId: SME_MARKETPLACE_GATE_ID, issuedAt: now, consumed: false, verified: true },
    };
    const token = variants[state];
    const result = matchSmeCoverageCategories({ approved_gap_id: "synthetic-gap", gap: { domain }, approval_token: token }, { now });
    assert.equal(result.ok, state === "valid");
    assert.equal(result.cost_log.estimated_cost_usd, 0);
    if (state === "valid") {
      assert.equal(token.consumed, true);
      assert.ok(result.scored_candidates.length <= 10);
    }
  },
)));
