import { cleanString } from "./helpers.js";

export const DEFAULT_SCRIPT_SEGMENT_CHARACTERS = 2400;
export const DEFAULT_SCRIPT_RETRIEVAL_TOP_K = 6;
export const DEFAULT_STORYBOARD_CONTEXT_CHARACTERS = 24000;

const SCENE_HEADING = /^(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?|SCENE\b)/i;
const SPEAKER_DIALOGUE = /^([\p{L}][\p{L}\p{N} ._'’-]{0,48}):\s*(.+)$/u;
const QUOTED_DIALOGUE = /["“][^"”]+["”]/u;

function tokenize(value) {
  return new Set(cleanString(value).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2));
}

function overlapScore(query, candidate) {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return 0;
  const candidateTokens = tokenize(candidate);
  let matches = 0;
  queryTokens.forEach((token) => { if (candidateTokens.has(token)) matches += 1; });
  return matches / queryTokens.size;
}

function classifyUnit(text) {
  if (SCENE_HEADING.test(text)) return { kind: "heading", speaker: "", spokenText: "" };
  const speakerMatch = text.match(SPEAKER_DIALOGUE);
  if (speakerMatch) {
    return { kind: "dialogue", speaker: cleanString(speakerMatch[1]), spokenText: cleanString(speakerMatch[2]) };
  }
  if (QUOTED_DIALOGUE.test(text)) return { kind: "dialogue", speaker: "", spokenText: text };
  return { kind: "plot", speaker: "", spokenText: "" };
}

function splitLine(line, absoluteStart) {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const trimOffset = line.indexOf(trimmed);
  const start = absoluteStart + trimOffset;
  if (SCENE_HEADING.test(trimmed) || SPEAKER_DIALOGUE.test(trimmed) || QUOTED_DIALOGUE.test(trimmed)) {
    return [{ text: trimmed, start, end: start + trimmed.length }];
  }
  const parts = [];
  const sentencePattern = /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/gu;
  for (const match of trimmed.matchAll(sentencePattern)) {
    const text = match[0].trim();
    if (!text) continue;
    const localOffset = match[0].indexOf(text);
    const partStart = start + (match.index || 0) + localOffset;
    parts.push({ text, start: partStart, end: partStart + text.length });
  }
  return parts.length ? parts : [{ text: trimmed, start, end: start + trimmed.length }];
}

export function buildScriptCorpus(script) {
  const text = typeof script === "string" ? script : "";
  const rawUnits = [];
  const linePattern = /[^\r\n]+/g;
  for (const match of text.matchAll(linePattern)) {
    rawUnits.push(...splitLine(match[0], match.index || 0));
  }
  const units = rawUnits.map((unit, index) => ({
    unitId: `script-unit-${index + 1}`,
    ...classifyUnit(unit.text),
    text: unit.text,
    sourceRange: { start: unit.start, end: unit.end },
  }));
  return {
    sourceCharacterCount: text.length,
    unitCount: units.length,
    plotBeatCount: units.filter((unit) => unit.kind === "plot").length,
    dialogueCount: units.filter((unit) => unit.kind === "dialogue").length,
    units,
  };
}

function segmentCorpus(corpus, targetCharacters) {
  const segments = [];
  let current = [];
  let characters = 0;
  const flush = () => {
    if (!current.length) return;
    const index = segments.length;
    segments.push({
      segmentId: `script-segment-${index + 1}`,
      sequence: index + 1,
      sourceRange: {
        start: current[0].sourceRange.start,
        end: current[current.length - 1].sourceRange.end,
      },
      unitIds: current.map((unit) => unit.unitId),
      plotBeatIds: current.filter((unit) => unit.kind === "plot").map((unit) => unit.unitId),
      dialogueIds: current.filter((unit) => unit.kind === "dialogue").map((unit) => unit.unitId),
      retainedText: current.map((unit) => unit.text).join("\n"),
    });
    current = [];
    characters = 0;
  };
  for (const unit of corpus.units) {
    if (current.length && characters + unit.text.length + 1 > targetCharacters) flush();
    current.push(unit);
    characters += unit.text.length + (current.length > 1 ? 1 : 0);
  }
  flush();
  return segments;
}

function mapSegmentsToShots(segments, plannedShots) {
  const shots = Array.isArray(plannedShots) ? plannedShots : [];
  return shots.map((shot, shotIndex) => {
    if (!segments.length) return { shotId: cleanString(shot?.shotId), segmentIds: [] };
    const start = Math.floor((shotIndex * segments.length) / shots.length);
    const end = Math.max(start + 1, Math.floor(((shotIndex + 1) * segments.length) / shots.length));
    const assigned = segments.slice(start, end);
    return { shotId: cleanString(shot?.shotId), segmentIds: assigned.map((segment) => segment.segmentId) };
  });
}

export function retrieveScriptUnits(query, corpus, options = {}) {
  const topK = Number.isFinite(Number(options.topK))
    ? Math.max(1, Math.floor(Number(options.topK)))
    : DEFAULT_SCRIPT_RETRIEVAL_TOP_K;
  return (Array.isArray(corpus?.units) ? corpus.units : [])
    .map((unit) => ({ unitId: unit.unitId, kind: unit.kind, score: overlapScore(query, unit.text), text: unit.text }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.unitId.localeCompare(right.unitId))
    .slice(0, topK);
}

function retainedIds(segments, field) {
  return new Set(segments.flatMap((segment) => segment[field]));
}

export function buildLongScriptDesign({ script, plannedShots, policy = {} } = {}) {
  const targetCharacters = Number.isFinite(Number(policy.segmentCharacters))
    ? Math.max(400, Math.floor(Number(policy.segmentCharacters)))
    : DEFAULT_SCRIPT_SEGMENT_CHARACTERS;
  const corpus = buildScriptCorpus(script);
  const segments = segmentCorpus(corpus, targetCharacters);
  const shotMappings = mapSegmentsToShots(segments, plannedShots);
  const retainedPlotIds = retainedIds(segments, "plotBeatIds");
  const retainedDialogueIds = retainedIds(segments, "dialogueIds");
  const plotBeatIds = corpus.units.filter((unit) => unit.kind === "plot").map((unit) => unit.unitId);
  const dialogueIds = corpus.units.filter((unit) => unit.kind === "dialogue").map((unit) => unit.unitId);
  const omittedPlotBeatIds = plotBeatIds.filter((unitId) => !retainedPlotIds.has(unitId));
  const omittedDialogueIds = dialogueIds.filter((unitId) => !retainedDialogueIds.has(unitId));
  return {
    corpus,
    segments,
    shotMappings,
    recommendedSceneCount: segments.length,
    retention: {
      plotBeatCoverage: plotBeatIds.length ? retainedPlotIds.size / plotBeatIds.length : 1,
      dialogueCoverage: dialogueIds.length ? retainedDialogueIds.size / dialogueIds.length : 1,
      omittedPlotBeatIds,
      omittedDialogueIds,
      ok: omittedPlotBeatIds.length === 0 && omittedDialogueIds.length === 0,
    },
  };
}

export function bindLongScriptToShots(plannedShots, design) {
  const segmentsById = new Map((design?.segments || []).map((segment) => [segment.segmentId, segment]));
  const unitsById = new Map((design?.corpus?.units || []).map((unit) => [unit.unitId, unit]));
  const mappingsByShotId = new Map((design?.shotMappings || []).map((mapping) => [mapping.shotId, mapping]));
  return (Array.isArray(plannedShots) ? plannedShots : []).map((shot) => {
    const segmentIds = mappingsByShotId.get(cleanString(shot?.shotId))?.segmentIds || [];
    const segments = segmentIds.map((segmentId) => segmentsById.get(segmentId)).filter(Boolean);
    const unitIds = [...new Set(segments.flatMap((segment) => segment.unitIds))];
    const dialogueUnitIds = unitIds.filter((unitId) => unitsById.get(unitId)?.kind === "dialogue");
    return {
      ...shot,
      scriptSegmentIds: segmentIds,
      scriptUnitIds: unitIds,
      dialogueUnitIds,
      scriptExcerpt: segments.map((segment) => segment.retainedText).join("\n\n"),
    };
  });
}

export function buildStoryboardScriptContext(design, characterBudget = DEFAULT_STORYBOARD_CONTEXT_CHARACTERS) {
  const budget = Number.isFinite(Number(characterBudget)) ? Math.max(1, Math.floor(Number(characterBudget))) : DEFAULT_STORYBOARD_CONTEXT_CHARACTERS;
  const entries = [];
  let usedCharacters = 0;
  for (const segment of Array.isArray(design?.segments) ? design.segments : []) {
    const content = `${segment.segmentId}\n${segment.retainedText}`;
    if (usedCharacters + content.length > budget) break;
    entries.push({ segmentId: segment.segmentId, content });
    usedCharacters += content.length;
  }
  return {
    sourceSegmentCount: design?.segments?.length || 0,
    retainedSegmentCount: entries.length,
    omittedSegmentIds: (design?.segments || []).slice(entries.length).map((segment) => segment.segmentId),
    usedCharacters,
    budgetCharacters: budget,
    entries,
  };
}
