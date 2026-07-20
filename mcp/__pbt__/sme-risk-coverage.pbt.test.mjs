import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import { validateCostLog } from "../../contracts/cost-log.schema.js";
import { stableStringify } from "../../contracts/semantic-key.js";
import {
  SME_GROWTH_STAGES,
  SME_PROFILE_SCHEMA_ID,
  SME_RISK_DOMAINS,
  parseSmeProfileMarkdown,
  printSmeProfileMarkdown,
  validateSmeProfile,
} from "../../contracts/sme-profile.schema.js";
import {
  adviseProtection,
  attachRationales,
  buildGrowthDelta,
  buildRiskExposureProfile,
  computeSmeRiskRun,
  detectCoverageGaps,
  gateSmeAction,
  runSmeRiskCoverageMarkdown,
  surfaceUnknownRisks,
} from "../sme-risk-coverage/core.js";

const text = fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789 -"), { minLength: 1, maxLength: 30 }).map((value) => value.trim() || "synthetic");
const list = fc.array(text, { maxLength: 8 });
const optionalList = fc.oneof(fc.constant("undeclared"), list);
const coverage = fc.oneof(
  fc.constant("undeclared"),
  fc.array(fc.oneof(text, fc.record({ category: fc.constantFrom(...SME_RISK_DOMAINS), scope: fc.constantFrom("full", "limited") })), { maxLength: 5 }),
);
const profileArb = fc.record({
  schema: fc.constant(SME_PROFILE_SCHEMA_ID),
  profile_id: text,
  industry: text,
  size: fc.integer({ min: 1, max: 250 }),
  growth_stage: fc.constantFrom(...SME_GROWTH_STAGES),
  assets: optionalList,
  digital_footprint: fc.oneof(fc.constant("undeclared"), text),
  suppliers: optionalList,
  declared_coverage: coverage,
}).filter((profile) => validateSmeProfile(profile).ok);
const check = (property) => fc.assert(property, { numRuns: 100 });

test("Property 1: parse/print round-trip and determinism", () => check(fc.property(profileArb, (profile) => {
  const first = printSmeProfileMarkdown(profile);
  const second = printSmeProfileMarkdown(profile);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.markdown, second.markdown);
  assert.deepEqual(parseSmeProfileMarkdown(first.markdown).profile, profile);
})));

test("Property 2: invalid profiles report a field and no partial object", () => check(fc.property(profileArb, fc.constantFrom("schema", "profile_id", "industry", "size", "growth_stage"), (profile, field) => {
  const invalid = { ...profile };
  delete invalid[field];
  const printed = `---\n${Object.entries(invalid).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n`;
  const result = parseSmeProfileMarkdown(printed);
  assert.equal(result.ok, false);
  assert.ok(result.error.path);
  assert.equal("profile" in result, false);
})));

test("Property 3: exposures cover all domains and are well formed", () => check(fc.property(profileArb, (profile) => {
  const exposures = buildRiskExposureProfile(profile).exposures;
  assert.deepEqual(new Set(exposures.map((item) => item.domain)), new Set(SME_RISK_DOMAINS));
  for (const item of exposures) {
    assert.ok(item.description.length >= 1 && item.description.length <= 500);
    assert.ok(["low", "medium", "high"].includes(item.likelihood));
    assert.ok(["low", "medium", "high"].includes(item.impact));
    assert.ok(item.source_fields.length > 0);
  }
})));

test("Property 4: coverage classification is total and emits the matching gaps", () => check(fc.property(profileArb, (profile) => {
  const exposureProfile = buildRiskExposureProfile(profile);
  const result = detectCoverageGaps(exposureProfile, profile.declared_coverage);
  assert.equal(result.matches.length, exposureProfile.exposures.length);
  for (const match of result.matches) {
    assert.ok(["covered", "partially_covered", "uncovered"].includes(match.outcome));
    assert.equal(result.gaps.filter((gap) => gap.exposure_key === match.exposure_key).length, match.outcome === "covered" ? 0 : 1);
    if (profile.declared_coverage === "undeclared") assert.equal(match.assumed_uncovered, true);
  }
})));

test("Property 5: gaps and protections have a total severity/key order", () => check(fc.property(profileArb, (profile) => {
  const gaps = detectCoverageGaps(buildRiskExposureProfile(profile), profile.declared_coverage).gaps;
  const protections = adviseProtection(gaps);
  const ranks = { critical: 0, high: 1, medium: 2, low: 3 };
  const ordered = (items, field) => items.every((item, index) => !index || ranks[items[index - 1].severity] < ranks[item.severity] || (ranks[items[index - 1].severity] === ranks[item.severity] && items[index - 1][field] <= item[field]));
  assert.equal(ordered(gaps, "exposure_key"), true);
  assert.equal(ordered(protections, "gap_key"), true);
})));

test("Property 6: unknown risks are disjoint from declared exposures", () => check(fc.property(profileArb, (profile) => {
  const exposures = buildRiskExposureProfile(profile).exposures;
  const result = surfaceUnknownRisks(exposures);
  const declared = new Set(exposures.filter((item) => item.resolution === "declared").map((item) => item.key));
  assert.ok(result.unknownRisks.every((item) => !declared.has(item.exposure_key)));
})));

test("Property 7: every gap has exactly one protection outcome", () => check(fc.property(profileArb, (profile) => {
  const gaps = detectCoverageGaps(buildRiskExposureProfile(profile), profile.declared_coverage).gaps;
  const protections = adviseProtection(gaps);
  assert.ok(gaps.every((gap) => protections.filter((item) => item.gap_key === gap.key).length === 1));
})));

test("Property 8: visible outputs contain no provider, route, model, or credential literals", () => check(fc.property(profileArb, (profile) => {
  const run = computeSmeRiskRun(profile).run;
  const visible = JSON.stringify({ exposures: run.exposureProfile.exposures, gaps: run.gaps, unknownRisks: run.unknownRisks, protections: run.protections, rationales: run.rationales });
  assert.doesNotMatch(visible, /(?:\b(?:provider|brand|model)\s*[:=]|\b(?:product[_ -]?id|api[_ -]?key|bearer)\b|https?:\/\/|\bsk-[a-z0-9]+)/i);
})));

test("Property 9: each visible item has exactly one traceable rationale", () => check(fc.property(profileArb, (profile) => {
  const run = computeSmeRiskRun(profile).run;
  const items = [...run.gaps, ...run.unknownRisks, ...run.protections];
  for (const item of items) {
    const rationale = run.rationales.filter((entry) => entry.item_key === item.key);
    assert.equal(rationale.length, 1);
    assert.ok(rationale[0].exposure_key && rationale[0].cited_fields.length > 0);
  }
})));

test("Property 10: model-free and blocked paths spend exactly zero", () => check(fc.property(profileArb, (profile) => {
  const run = computeSmeRiskRun(profile).run;
  const blocked = gateSmeAction("bind", null);
  for (const cost of [...run.costLogs, blocked.costLog]) {
    assert.equal(cost.prompt_tokens, 0);
    assert.equal(cost.completion_tokens, 0);
    assert.equal(cost.estimated_cost_usd, 0);
    assert.equal(cost.paid_model_calls, 0);
  }
})));

test("Property 11: invalid approval blocks mutation and spend", () => check(fc.property(fc.constantFrom("purchase", "bind", "apply", "contact_third_party", "paid_model_call"), fc.integer(), (action, offset) => {
  const result = gateSmeAction(action, { action: `${action}-other`, state: "approved", expiresAt: Date.now() + Math.abs(offset) });
  assert.equal(result.status, "blocked");
  assert.equal(result.mutationPerformed, false);
  assert.equal(result.costLog.estimated_cost_usd, 0);
})));

test("Property 12: growth change records delta and unchanged input reuses", () => check(fc.property(profileArb, fc.constantFrom(...SME_GROWTH_STAGES), (profile, stage) => {
  const first = computeSmeRiskRun(profile).run;
  const next = { ...profile, growth_stage: stage };
  const result = computeSmeRiskRun(next, { previousRun: first, previousProfile: profile });
  if (stage === profile.growth_stage) {
    assert.equal(result.run.reuse, true);
    assert.equal(result.run.costLogs[0].estimated_cost_usd, 0);
  } else {
    assert.equal(result.run.delta.changed, true);
    assert.equal(result.run.delta.reason, "growth_stage_or_size_changed");
  }
  const invalidStage = computeSmeRiskRun({ ...profile, growth_stage: "unsupported" }, { previousRun: first, previousProfile: profile });
  const invalidSize = computeSmeRiskRun({ ...profile, size: 0 }, { previousRun: first, previousProfile: profile });
  assert.equal(invalidStage.error.code, "invalid_growth_stage");
  assert.equal(invalidSize.error.code, "invalid_size");
  assert.equal(invalidStage.mutationPerformed, false);
  assert.equal(invalidSize.mutationPerformed, false);
})));

test("Property 13: malformed input fails before spend without mutation", () => check(fc.property(text, (value) => {
  const result = runSmeRiskCoverageMarkdown(value);
  assert.equal(result.ok, false);
  assert.equal(result.mutationPerformed, false);
  assert.equal(result.costLogs[0].estimated_cost_usd, 0);
})));

test("Property 14: every deterministic stage is stable across repeated calls", () => check(fc.property(profileArb, (profile) => {
  const one = computeSmeRiskRun(profile);
  const two = computeSmeRiskRun(profile);
  assert.equal(stableStringify(one), stableStringify(two));
  const exposures = buildRiskExposureProfile(profile).exposures;
  const gaps = detectCoverageGaps({ exposures }, profile.declared_coverage).gaps;
  assert.equal(stableStringify(attachRationales({ exposures, gaps, unknownRisks: surfaceUnknownRisks(exposures).unknownRisks, protections: adviseProtection(gaps) })), stableStringify(attachRationales({ exposures, gaps, unknownRisks: surfaceUnknownRisks(exposures).unknownRisks, protections: adviseProtection(gaps) })));
})));

test("Property 15: every emitted Cost_Log is canonical-schema valid", () => check(fc.property(profileArb, (profile) => {
  const result = computeSmeRiskRun(profile);
  assert.ok(result.run.costLogs.every((entry) => validateCostLog(entry).valid));
})));
