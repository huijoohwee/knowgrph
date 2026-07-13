import { createCostLog } from "../../contracts/cost-log.schema.js";
import { buildSemanticKey, stableStringify } from "../../contracts/semantic-key.js";
import {
  SME_GROWTH_STAGES,
  SME_RISK_DOMAINS,
  SME_SIZE_RANGE,
  SME_UNDECLARED,
  parseSmeProfileMarkdown,
  printSmeProfileMarkdown,
  validateSmeProfile,
} from "../../contracts/sme-profile.schema.js";
import {
  SME_GUIDANCE_DISCLAIMER,
  SME_RISK_RUN_SCHEMA_ID,
  SME_SEVERITIES,
  validateSmeRiskRun,
} from "../../contracts/sme-risk-coverage.schema.js";

export const SME_SKILL_VARIANT = "agent.sme";
export const SME_SKILL_ID = "sme.risk.profile";
export const SME_RUNTIME_KERNEL = SME_SKILL_ID;
export const SME_TOKEN_BUDGET_MAX = 100_000;
export const SME_TIMEOUT_SECONDS_MAX = 300;
export const SME_MAX_ITERATIONS = 1;
export const SME_CIRCUIT_BREAKERS = Object.freeze(["schema_error", "approval_denial", "token_budget_breach", "verification_failure"]);

const severityRank = new Map(SME_SEVERITIES.map((severity, index) => [severity, index]));
const levelRank = Object.freeze({ low: 1, medium: 2, high: 3 });
const zeroCost = (stage) => ({ ...createCostLog({ model: "local-dry-run", prompt_tokens: 0, completion_tokens: 0, cache_hits: 0, estimated_cost_usd: 0 }), stage, paid_model_calls: 0 });
const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function deriveGapSeverity(exposure) {
  const likelihood = levelRank[exposure.likelihood] || 1;
  const impact = levelRank[exposure.impact] || 1;
  if (likelihood === 3 && impact === 3) return "critical";
  if (likelihood + impact >= 5) return "high";
  if (likelihood === 1 && impact === 1) return "low";
  return "medium";
}

export function compareSeverityThenKey(left, right, keyField) {
  return (severityRank.get(left.severity) - severityRank.get(right.severity)) || String(left[keyField]).localeCompare(String(right[keyField]));
}

const exposureTemplate = (profile, domain) => {
  const growthImpact = ["growth", "established"].includes(profile.growth_stage) || profile.size >= 50 ? "high" : "medium";
  if (domain === "cyber") {
    const missing = profile.digital_footprint === SME_UNDECLARED;
    return {
      type: missing ? "digital_footprint_insufficient_input" : "digital_service_disruption",
      description: missing ? "Digital footprint information is undeclared, so cyber exposure cannot be fully evaluated." : `Digital service disruption or unauthorized access could interrupt this ${profile.industry} business.`,
      likelihood: missing ? "medium" : profile.digital_footprint.toLowerCase().includes("online") ? "high" : "medium",
      impact: growthImpact,
      source_fields: ["digital_footprint", "industry", "growth_stage"],
      resolution: missing ? "insufficient_input" : "declared",
      inference_chain: missing ? ["digital_footprint is undeclared", "cyber dependency remains unknown", "evaluate digital exposure"] : [],
    };
  }
  if (domain === "supply_chain") {
    const missing = profile.suppliers === SME_UNDECLARED;
    return {
      type: missing ? "supplier_dependency_insufficient_input" : "supplier_interruption",
      description: missing ? "Supplier information is undeclared, so dependency and interruption exposure cannot be fully evaluated." : "Supplier interruption could delay operations, inventory, or customer delivery.",
      likelihood: missing ? "medium" : profile.suppliers.length > 5 ? "high" : "medium",
      impact: growthImpact,
      source_fields: ["suppliers", "size", "growth_stage"],
      resolution: missing ? "insufficient_input" : "declared",
      inference_chain: missing ? ["suppliers are undeclared", "dependency concentration remains unknown", "evaluate supply-chain exposure"] : [],
    };
  }
  const missing = profile.assets === SME_UNDECLARED;
  return {
    type: missing ? "asset_inventory_insufficient_input" : "asset_damage_or_loss",
    description: missing ? "Asset information is undeclared, so physical loss and interruption exposure cannot be fully evaluated." : "Damage, theft, or loss of physical assets could interrupt business operations.",
    likelihood: missing ? "medium" : profile.assets.length > 10 ? "high" : "medium",
    impact: growthImpact,
    source_fields: ["assets", "industry", "size"],
    resolution: missing ? "insufficient_input" : "declared",
    inference_chain: missing ? ["assets are undeclared", "physical values and concentrations remain unknown", "evaluate asset exposure"] : [],
  };
};

export function buildRiskExposureProfile(profile) {
  const exposures = SME_RISK_DOMAINS.map((domain) => {
    const template = exposureTemplate(profile, domain);
    const key = buildSemanticKey("sme.exposure", { profile_id: profile.profile_id, domain, type: template.type, source_fields: template.source_fields });
    return { key, domain, ...template };
  });
  return {
    run_id: buildSemanticKey("sme.run", { profile_id: profile.profile_id, profile: stableStringify(profile) }),
    exposures,
  };
}

function coverageFields(coverage) {
  if (typeof coverage === "string") return { label: normalize(coverage), category: "", scope: "full", semantic_key: "" };
  return {
    label: normalize(coverage.label), category: normalize(coverage.category), scope: normalize(coverage.scope || "full"), semantic_key: String(coverage.semantic_key || ""),
  };
}

export function detectCoverageGaps(exposureProfile, declaredCoverage) {
  const matches = [];
  const gaps = [];
  for (const exposure of exposureProfile.exposures || []) {
    let outcome = "uncovered";
    let tier = "category";
    let assumed_uncovered = declaredCoverage === SME_UNDECLARED;
    if (!assumed_uncovered) {
      const entries = Array.isArray(declaredCoverage) ? declaredCoverage.map(coverageFields) : [];
      const exact = entries.find((entry) => entry.semantic_key === exposure.key || entry.label === normalize(exposure.type));
      const category = entries.find((entry) => entry.category === normalize(exposure.domain) || entry.label === normalize(exposure.domain));
      const matched = exact || category;
      if (matched) {
        tier = exact ? "exact" : "category";
        outcome = ["limited", "partial", "partially_covered"].includes(matched.scope) ? "partially_covered" : "covered";
      }
    }
    const match = { exposure_key: exposure.key, outcome, tier, confidence: null, assumed_uncovered };
    matches.push(match);
    if (outcome !== "covered") {
      gaps.push({
        key: buildSemanticKey("sme.gap", { exposure_key: exposure.key, outcome }),
        exposure_key: exposure.key,
        domain: exposure.domain,
        match_outcome: outcome,
        severity: deriveGapSeverity(exposure),
        assumed_uncovered,
      });
    }
  }
  gaps.sort((left, right) => compareSeverityThenKey(left, right, "exposure_key"));
  return { matches, gaps };
}

export function surfaceUnknownRisks(exposures) {
  const unknownRisks = [];
  const unsupportedInferences = [];
  for (const exposure of exposures || []) {
    if (exposure.resolution === "declared") continue;
    if (!Array.isArray(exposure.source_fields) || exposure.source_fields.length === 0) {
      unsupportedInferences.push({ exposure_key: exposure.key, reason: "unsupported_inference" });
      continue;
    }
    unknownRisks.push({
      key: buildSemanticKey("sme.unknown", { exposure_key: exposure.key, source_fields: exposure.source_fields }),
      exposure_key: exposure.key,
      trigger_fields: [...exposure.source_fields],
      inference_chain: [...(exposure.inference_chain || [])],
    });
  }
  return { unknownRisks, unsupportedInferences };
}

const GUIDANCE = Object.freeze({
  cyber: "Review cyber controls, incident response, recovery capability, exclusions, limits, and protection appropriate to the declared digital footprint.",
  supply_chain: "Review supplier concentration, continuity alternatives, contractual allocation, interruption scenarios, exclusions, and suitable protection limits.",
  asset_physical: "Inventory critical assets and review prevention, replacement values, interruption scenarios, exclusions, deductibles, and suitable protection limits.",
});
const FORBIDDEN_OUTPUT = /(?:\b(?:provider|brand|model)\s*[:=]|\b(?:product[_ -]?id|api[_ -]?key|bearer)\b|https?:\/\/|\/v\d+\/|\bsk-[a-z0-9]+)/i;

export function adviseProtection(gaps) {
  return [...(gaps || [])].sort((left, right) => compareSeverityThenKey(left, right, "key")).map((gap) => {
    const guidance = GUIDANCE[gap.domain];
    const result = guidance && !FORBIDDEN_OUTPUT.test(guidance) ? "recommendation" : "no_recommendation";
    return {
      key: buildSemanticKey("sme.protection", { gap_key: gap.key, result }),
      gap_key: gap.key,
      exposure_key: gap.exposure_key,
      severity: gap.severity,
      result,
      guidance: result === "recommendation" ? guidance : "No provider-agnostic recommendation is available; retain this gap for qualified review.",
    };
  });
}

export function attachRationales({ exposures, gaps, unknownRisks, protections }) {
  const byExposure = new Map(exposures.map((item) => [item.key, item]));
  const byGap = new Map(gaps.map((item) => [item.key, item]));
  const visible = { gaps: [], unknownRisks: [], protections: [] };
  const rationales = [];
  const blocked = [];
  const attach = (kind, item, exposureKey, gapRef = null) => {
    const exposure = byExposure.get(exposureKey);
    const gap = gapRef ? byGap.get(gapRef) : null;
    if (!exposure || !Array.isArray(exposure.source_fields) || exposure.source_fields.length === 0 || (gapRef && !gap)) {
      blocked.push({ kind, item, reason: "untraceable_recommendation" });
      return;
    }
    const itemKey = item.key;
    rationales.push({
      key: buildSemanticKey("sme.rationale", { item_key: itemKey, exposure_key: exposureKey }),
      item_key: itemKey,
      exposure_key: exposureKey,
      cited_fields: [...exposure.source_fields],
      gap_ref: gapRef,
      text: gap ? `This ${gap.severity} protection gap follows from the ${exposure.domain} exposure and the declared profile fields ${exposure.source_fields.join(", ")}.` : `This ${kind === "unknownRisks" ? "unknown risk" : "coverage gap"} follows from the ${exposure.domain} exposure and the profile fields ${exposure.source_fields.join(", ")}.`,
    });
    visible[kind].push({ ...item, rationale_key: rationales.at(-1).key });
  };
  gaps.forEach((item) => attach("gaps", item, item.exposure_key));
  unknownRisks.forEach((item) => attach("unknownRisks", item, item.exposure_key));
  protections.forEach((item) => attach("protections", item, item.exposure_key, item.gap_key));
  return { ...visible, rationales, blocked };
}

export function buildGrowthDelta(previousRun, currentRun, previousProfile, currentProfile) {
  const changed = previousProfile?.growth_stage !== currentProfile.growth_stage || previousProfile?.size !== currentProfile.size;
  if (!previousRun || !previousProfile) return { changed: true, reason: "initial_run", added: currentRun.gaps.map((gap) => gap.key), removed: [], reranked: [] };
  if (!changed) return { changed: false, reason: "unchanged_growth_stage_and_size", added: [], removed: [], reranked: [] };
  const before = new Map(previousRun.gaps.map((gap, index) => [gap.key, { severity: gap.severity, index }]));
  const after = new Map(currentRun.gaps.map((gap, index) => [gap.key, { severity: gap.severity, index }]));
  return {
    changed: true,
    reason: "growth_stage_or_size_changed",
    added: [...after.keys()].filter((key) => !before.has(key)),
    removed: [...before.keys()].filter((key) => !after.has(key)),
    reranked: [...after.keys()].filter((key) => before.has(key) && (before.get(key).severity !== after.get(key).severity || before.get(key).index !== after.get(key).index)),
  };
}

export function gateSmeAction(action, approval, now = Date.now()) {
  const gated = ["purchase", "bind", "apply", "contact_third_party", "paid_model_call"].includes(action);
  if (!gated) return { status: "allowed", action, costLog: zeroCost("approval_gate") };
  const valid = approval && approval.action === action && approval.state === "approved" && Number.isFinite(approval.expiresAt) && approval.expiresAt > now;
  return valid
    ? { status: "approved", action, approvalId: approval.id, costLog: zeroCost("approval_gate") }
    : { status: "blocked", action, reason: "approval_required", costLog: zeroCost("approval_gate"), mutationPerformed: false };
}

export function computeSmeRiskRun(profile, { previousRun = null, previousProfile = null, tokenBudget = SME_TOKEN_BUDGET_MAX, timeoutSeconds = SME_TIMEOUT_SECONDS_MAX } = {}) {
  if (previousProfile) {
    const transition = validateGrowthTransition(profile);
    if (!transition.ok) return { ok: false, error: transition.error, costLogs: [zeroCost("growth_transition_validation")], mutationPerformed: false };
  }
  const validation = validateSmeProfile(profile);
  if (!validation.ok) return { ok: false, error: validation.error, costLogs: [zeroCost("input_validation")], mutationPerformed: false };
  if (!Number.isInteger(tokenBudget) || tokenBudget < 0 || tokenBudget > SME_TOKEN_BUDGET_MAX) return { ok: false, error: { code: "token_budget_breach", maximum: SME_TOKEN_BUDGET_MAX }, costLogs: [zeroCost("budget_gate")], mutationPerformed: false };
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > SME_TIMEOUT_SECONDS_MAX) return { ok: false, error: { code: "invalid_timeout", maximumSeconds: SME_TIMEOUT_SECONDS_MAX }, costLogs: [zeroCost("timeout_gate")], mutationPerformed: false };
  const currentProfile = validation.profile;
  const unchanged = previousRun && previousProfile && previousProfile.growth_stage === currentProfile.growth_stage && previousProfile.size === currentProfile.size && stableStringify(previousProfile) === stableStringify(currentProfile);
  if (unchanged) return { ok: true, run: { ...structuredClone(previousRun), reuse: true, delta: buildGrowthDelta(previousRun, previousRun, previousProfile, currentProfile), costLogs: [zeroCost("growth_reuse")] } };
  const exposureProfile = buildRiskExposureProfile(currentProfile);
  const { matches, gaps } = detectCoverageGaps(exposureProfile, currentProfile.declared_coverage);
  const { unknownRisks, unsupportedInferences } = surfaceUnknownRisks(exposureProfile.exposures);
  const protections = adviseProtection(gaps);
  const explained = attachRationales({ exposures: exposureProfile.exposures, gaps, unknownRisks, protections });
  const costLogs = ["intake", "risk_profiler", "gap_detector", "unknown_risk_surfacer", "protection_advisor", "explainability_engine", "cost_observer"].map(zeroCost);
  const run = {
    contractVersion: SME_RISK_RUN_SCHEMA_ID,
    runId: exposureProfile.run_id,
    skillVariant: SME_SKILL_VARIANT,
    skillId: SME_SKILL_ID,
    topology: { pattern: "fan-out/fan-in", domains: [...SME_RISK_DOMAINS], maxIterations: SME_MAX_ITERATIONS, circuitBreakers: [...SME_CIRCUIT_BREAKERS] },
    profile: currentProfile,
    exposureProfile,
    coverageMatches: matches,
    gaps: explained.gaps,
    unknownRisks: explained.unknownRisks,
    protections: explained.protections,
    rationales: explained.rationales,
    trace: { blocked: explained.blocked, unsupportedInferences },
    costLogs,
    budget: { tokenBudget, tokensUsed: 0, timeoutSeconds, paidModelCalls: 0 },
    disclaimer: SME_GUIDANCE_DISCLAIMER,
    deployment: { status: "dev-only", prodMirrorMutation: false, cloudflareMutation: false },
  };
  run.delta = buildGrowthDelta(previousRun, run, previousProfile, currentProfile);
  const outputValidation = validateSmeRiskRun(run);
  if (!outputValidation.valid) return { ok: false, error: { code: "verification_failure", details: outputValidation.errors }, costLogs, mutationPerformed: false };
  return { ok: true, run };
}

const markdownArtifact = (title, payload) => `# ${title}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;

export function buildSmeSourceFiles(run) {
  const profileDocument = printSmeProfileMarkdown(run.profile);
  if (!profileDocument.ok) throw new Error(profileDocument.error.reason);
  const base = `sme-agent/runs/${run.runId}`;
  return {
    [`sme-agent/profiles/${run.profile.profile_id}/profile.md`]: profileDocument.markdown,
    [`${base}/exposures.md`]: markdownArtifact("Risk Exposures", run.exposureProfile),
    [`${base}/gaps.md`]: markdownArtifact("Coverage Gaps", { matches: run.coverageMatches, gaps: run.gaps, unknownRisks: run.unknownRisks }),
    [`${base}/protection.md`]: markdownArtifact("Protection Guidance", { disclaimer: run.disclaimer, protections: run.protections }),
    [`${base}/rationale.md`]: markdownArtifact("Rationales", run.rationales),
    [`${base}/delta.md`]: markdownArtifact("Growth Delta", run.delta),
  };
}

export function runSmeRiskCoverageMarkdown(markdown, options = {}) {
  const parsed = parseSmeProfileMarkdown(markdown);
  if (!parsed.ok) return { ok: false, error: parsed.error, costLogs: [zeroCost("input_validation")], mutationPerformed: false };
  return computeSmeRiskRun(parsed.profile, options);
}

export function validateGrowthTransition(profile) {
  if (!SME_GROWTH_STAGES.includes(profile?.growth_stage)) return { ok: false, error: { code: "invalid_growth_stage", allowed: [...SME_GROWTH_STAGES] } };
  if (!Number.isInteger(profile?.size) || profile.size < SME_SIZE_RANGE.minimum || profile.size > SME_SIZE_RANGE.maximum) return { ok: false, error: { code: "invalid_size", allowed: { ...SME_SIZE_RANGE } } };
  return { ok: true };
}
