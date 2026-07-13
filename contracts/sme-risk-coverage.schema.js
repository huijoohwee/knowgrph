import { validateCostLog } from "./cost-log.schema.js";
import { SME_RISK_DOMAINS } from "./sme-profile.schema.js";

export const SME_RISK_RUN_SCHEMA_ID = "knowgrph-sme-risk-run/v1";
export const SME_SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);
export const SME_MATCH_OUTCOMES = Object.freeze(["covered", "partially_covered", "uncovered"]);
export const SME_LIKELIHOODS = Object.freeze(["low", "medium", "high"]);
export const SME_GUIDANCE_DISCLAIMER = "Decision-support guidance only; this is not regulated financial or insurance advice.";

export function validateSmeRiskRun(run) {
  const errors = [];
  const add = (path, reason) => errors.push({ path, reason });
  if (!run || typeof run !== "object" || Array.isArray(run)) return { valid: false, errors: [{ path: "", reason: "run must be an object" }] };
  if (run.contractVersion !== SME_RISK_RUN_SCHEMA_ID) add("contractVersion", `must equal ${SME_RISK_RUN_SCHEMA_ID}`);
  const exposures = run.exposureProfile?.exposures;
  if (!Array.isArray(exposures)) add("exposureProfile.exposures", "must be an array");
  else for (const domain of SME_RISK_DOMAINS) if (!exposures.some((entry) => entry.domain === domain)) add("exposureProfile.exposures", `must cover ${domain}`);
  for (const [field, allowed] of [["gaps", SME_SEVERITIES], ["protections", SME_SEVERITIES]]) {
    if (!Array.isArray(run[field])) add(field, "must be an array");
    else run[field].forEach((entry, index) => { if (!allowed.includes(entry.severity)) add(`${field}[${index}].severity`, "invalid severity"); });
  }
  if (!Array.isArray(run.costLogs)) add("costLogs", "must be an array");
  else run.costLogs.forEach((entry, index) => { const result = validateCostLog(entry); if (!result.valid) add(`costLogs[${index}]`, JSON.stringify(result.errors)); });
  if (run.disclaimer !== SME_GUIDANCE_DISCLAIMER) add("disclaimer", "guidance-only disclaimer is required");
  return { valid: errors.length === 0, errors };
}
