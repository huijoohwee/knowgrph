import fs from "node:fs/promises";
import path from "node:path";

import { COST_LOG_UNKNOWN, validateCostLog } from "../contracts/cost-log.schema.js";
import { creditLedgerEventFromRenderEvent, validateCreditLedgerEvent } from "../contracts/credit-ledger.schema.js";
import { OS_STATUS_MODEL_BEARING_HARNESSES, OS_STATUS_RUN_DIRS } from "./os-status-contract.js";

const text = (value) => String(value || "").trim();
const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
const isMissingFile = (error) => isRecord(error) && error.code === "ENOENT";

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readJsonLines(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
}

const numericValue = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
};

const sumMoney = (values) => Number(values.reduce((total, value) => total + Number(value || 0), 0).toFixed(6));

async function listRunDirs(rootDir, relativeDir, harness, unavailableSources) {
  const absoluteDir = path.join(rootDir, relativeDir);
  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ runId: entry.name, sourceDir: path.join(relativeDir, entry.name) }));
  } catch (error) {
    unavailableSources.push({ harness, sourceRef: relativeDir, reason: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function readVideoRemixManifests({ rootDir, unavailableSources }) {
  const manifests = [];
  const candidates = await listRunDirs(rootDir, OS_STATUS_RUN_DIRS.videoRemix, "video_remix", unavailableSources);
  for (const candidate of candidates) {
    for (const fileName of ["run-manifest.json", "manifest.json"]) {
      const sourceRef = path.join(candidate.sourceDir, fileName);
      try {
        manifests.push({ runId: candidate.runId, sourceRef, manifest: await readJson(path.join(rootDir, sourceRef)) });
        break;
      } catch {
        /* Conventional manifest filenames are tried in order. */
      }
    }
  }
  return manifests;
}

function normalizeRawCostLog(entry, fallbackModel) {
  if (isRecord(entry) && "estimated_cost_usd" in entry) return entry;
  return {
    model: text(entry?.model) || fallbackModel,
    prompt_tokens: COST_LOG_UNKNOWN,
    completion_tokens: COST_LOG_UNKNOWN,
    cache_hits: 0,
    estimated_cost_usd: numericValue(entry?.estimatedCostUsd ?? entry?.estimated_cost_usd),
    incomplete: true,
  };
}

function recordCostLog({ records, validationFailures, harness, sourceRef, entry, index, sourceKind = "Cost_Log" }) {
  const costLog = normalizeRawCostLog(entry, `${harness}:unknown`);
  const validation = validateCostLog(costLog);
  if (!validation.valid) {
    validationFailures.push({ harness, sourceRef, index, sourceKind, entry: costLog, errors: validation.errors });
    return;
  }
  records.push({ harness, sourceRef, sourceKind, costLog });
}

function normalizeCreditLedgerEntry(entry, fallback = {}) {
  const source = isRecord(entry) ? entry : {};
  if ("providerSpendUsd" in source) {
    return {
      ledgerEventId: source.ledgerEventId,
      runId: source.runId ?? fallback.runId,
      shotId: source.shotId,
      provider: source.provider,
      providerSpendUsd: source.providerSpendUsd,
    };
  }
  return creditLedgerEventFromRenderEvent({
    ledgerEventId: source.ledgerEventId,
    runId: source.runId ?? fallback.runId,
    shotId: source.shotId,
    provider: source.provider,
    providerSpendCents: source.providerSpendCents ?? source.costCents,
  });
}

function recordCreditLedgerEntry({ records, validationFailures, harness, sourceRef, entry, index, runId }) {
  const creditLedger = normalizeCreditLedgerEntry(entry, { runId });
  const creditValidation = validateCreditLedgerEvent(creditLedger);
  if (!creditValidation.valid) {
    validationFailures.push({ harness, sourceRef, index, sourceKind: "Credit_Ledger", entry: creditLedger, errors: creditValidation.errors });
    return;
  }
  recordCostLog({
    records,
    validationFailures,
    harness,
    sourceRef,
    entry: {
      model: `credit_ledger:${text(creditLedger.provider) || "unknown"}`,
      prompt_tokens: COST_LOG_UNKNOWN,
      completion_tokens: COST_LOG_UNKNOWN,
      cache_hits: 0,
      estimated_cost_usd: creditLedger.providerSpendUsd,
      incomplete: true,
    },
    index,
    sourceKind: "Credit_Ledger",
  });
}

function manifestCreditLedgerEntries(manifest) {
  const render = isRecord(manifest?.render) ? manifest.render : {};
  const explicitSources = [render.ledgerEvents, manifest?.ledgerEvents, manifest?.creditLedgerEvents, manifest?.creditLedger];
  const explicit = explicitSources.find((candidate) => Array.isArray(candidate));
  if (explicit) return explicit;
  return Array.isArray(render.assets) ? render.assets.filter((asset) => asset?.ledgerEventId) : [];
}

async function collectJsonlCostSources({ rootDir, records, validationFailures, unavailableSources, harness, relativeDir }) {
  const candidates = await listRunDirs(rootDir, relativeDir, harness, unavailableSources);
  for (const candidate of candidates) {
    for (const source of [
      { fileName: "cost-log.jsonl", kind: "Cost_Log", optional: false },
      { fileName: "credit-ledger.jsonl", kind: "Credit_Ledger", optional: true },
    ]) {
      const sourceRef = path.join(candidate.sourceDir, source.fileName);
      try {
        const entries = await readJsonLines(path.join(rootDir, sourceRef));
        entries.forEach((entry, index) => {
          if (source.kind === "Credit_Ledger") {
            recordCreditLedgerEntry({ records, validationFailures, harness, sourceRef, entry, index, runId: candidate.runId });
            return;
          }
          recordCostLog({ records, validationFailures, harness, sourceRef, entry, index });
        });
      } catch (error) {
        if (source.optional && isMissingFile(error)) continue;
        unavailableSources.push({ harness, sourceRef, reason: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}

async function collectCostLogRecords({ rootDir, unavailableSources }) {
  const records = [];
  const validationFailures = [];
  await collectJsonlCostSources({ rootDir, records, validationFailures, unavailableSources, harness: "showrunner", relativeDir: OS_STATUS_RUN_DIRS.showrunner });
  await collectJsonlCostSources({ rootDir, records, validationFailures, unavailableSources, harness: "superagent", relativeDir: OS_STATUS_RUN_DIRS.superagent });
  for (const { runId, sourceRef, manifest } of await readVideoRemixManifests({ rootDir, unavailableSources })) {
    const rawLogs = Array.isArray(manifest.rawCostLogs) ? manifest.rawCostLogs : [];
    rawLogs.forEach((entry, index) => recordCostLog({ records, validationFailures, harness: "video_remix", sourceRef, entry, index }));
    const stageLogs = Array.isArray(manifest.costLogs) ? manifest.costLogs : [];
    stageLogs.forEach((entry, index) => recordCostLog({
      records,
      validationFailures,
      harness: "video_remix",
      sourceRef,
      entry: { ...entry, model: `video_remix:${text(entry?.stageId) || index}` },
      index: rawLogs.length + index,
    }));
    manifestCreditLedgerEntries(manifest).forEach((entry, index) => recordCreditLedgerEntry({
      records,
      validationFailures,
      harness: "video_remix",
      sourceRef,
      entry,
      index: rawLogs.length + stageLogs.length + index,
      runId,
    }));
  }
  return { records, validationFailures };
}

async function listReadableProcessHarnesses({ rootDir, unavailableSources }) {
  const harnesses = new Set();
  for (const { harness, relativeDir, fileName } of [
    { harness: "showrunner", relativeDir: OS_STATUS_RUN_DIRS.showrunner, fileName: "state.json" },
    { harness: "superagent", relativeDir: OS_STATUS_RUN_DIRS.superagent, fileName: "state.json" },
  ]) {
    for (const candidate of await listRunDirs(rootDir, relativeDir, harness, unavailableSources)) {
      try {
        await readJson(path.join(rootDir, candidate.sourceDir, fileName));
        harnesses.add(harness);
      } catch {
        /* Unreadable process state is already surfaced by Process_Registry. */
      }
    }
  }
  if ((await readVideoRemixManifests({ rootDir, unavailableSources })).length) harnesses.add("video_remix");
  return [...harnesses];
}

export async function summarizeCostLedger({ rootDir = process.cwd() } = {}) {
  const unavailableSources = [];
  const { records, validationFailures } = await collectCostLogRecords({ rootDir, unavailableSources });
  const totalsByHarness = {};
  for (const record of records) {
    totalsByHarness[record.harness] = {
      estimated_cost_usd: sumMoney([totalsByHarness[record.harness]?.estimated_cost_usd || 0, record.costLog.estimated_cost_usd]),
    };
  }
  const readableHarnesses = await listReadableProcessHarnesses({ rootDir, unavailableSources: [] });
  const processHarnessGaps = readableHarnesses
    .filter((harness) => !records.some((record) => record.harness === harness))
    .map((harness) => ({ harness, reason: "No valid Cost_Log or Credit_Ledger entries found for readable process entries." }));
  const coverageGaps = OS_STATUS_MODEL_BEARING_HARNESSES
    .filter((harness) => !records.some((record) => record.harness === harness))
    .filter((harness) => !processHarnessGaps.some((gap) => gap.harness === harness))
    .map((harness) => ({ harness, reason: "No enumerable schema-valid Cost_Log or Credit_Ledger source is configured for this model-bearing harness." }));
  const costEmissionGaps = [...processHarnessGaps, ...coverageGaps].sort((left, right) => left.harness.localeCompare(right.harness));
  return { ok: true, totalsByHarness, validationFailures, costEmissionGaps, unavailableSources };
}
