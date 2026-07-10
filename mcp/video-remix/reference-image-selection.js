import { cleanString } from "./helpers.js";

export const REFERENCE_IMAGE_KINDS = Object.freeze(["character", "environment", "storyboard", "object", "style"]);
export const DEFAULT_MAX_REFERENCES_PER_SHOT = 4;

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringList(value) {
  return Array.isArray(value) ? [...new Set(value.map((entry) => cleanString(entry)).filter(Boolean))] : [];
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function signature(value) {
  const record = plainRecord(value);
  return Object.keys(record).length ? JSON.stringify(stableValue(record)) : "";
}

export function normalizeReferenceSelectionPolicy(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const maximum = Number(input.maxReferencesPerShot);
  return {
    maxReferencesPerShot: Number.isFinite(maximum) ? Math.max(1, Math.min(8, Math.floor(maximum))) : DEFAULT_MAX_REFERENCES_PER_SHOT,
    includePreviousTimeline: input.includePreviousTimeline !== false,
    requireCharacterCoverage: input.requireCharacterCoverage === true,
    requireEnvironmentCoverage: input.requireEnvironmentCoverage === true,
  };
}

function explicitCatalog(referenceImages) {
  return (Array.isArray(referenceImages) ? referenceImages : []).map((reference) => ({
    referenceId: cleanString(reference.id),
    kind: REFERENCE_IMAGE_KINDS.includes(reference.kind) ? reference.kind : "style",
    assetUrl: cleanString(reference.assetUrl),
    entityIds: stringList(reference.entityIds),
    sceneId: cleanString(reference.sceneId),
    actionBeatId: cleanString(reference.actionBeatId),
    environmentSignature: signature(reference.environmentState),
    sourceShotId: cleanString(reference.sourceShotId),
    origin: "operator",
  }));
}

function timelineCatalog(priorAssets, shotsById) {
  return (Array.isArray(priorAssets) ? priorAssets : []).flatMap((asset) => {
    const shotId = cleanString(asset?.shotId);
    const assetUrl = cleanString(asset?.durableR2Url || asset?.assetUrl || asset?.storageUri);
    if (!shotId || !assetUrl) return [];
    const sourceShot = shotsById.get(shotId) || {};
    return [{
      referenceId: `timeline:${shotId}`,
      kind: "storyboard",
      assetUrl,
      entityIds: stringList(sourceShot.characterIds),
      sceneId: cleanString(sourceShot.sceneId),
      actionBeatId: cleanString(sourceShot.actionBeatId),
      environmentSignature: signature(sourceShot.spatialBlocking?.background || sourceShot.environmentState),
      sourceShotId: shotId,
      origin: "previous_timeline",
    }];
  });
}

function candidateScore(reference, shot, shotIndex, sourceShotIndexes, characterReferenceIds) {
  let score = reference.origin === "operator" ? 5 : 0;
  const reasons = reference.origin === "operator" ? ["operator_reference"] : [];
  const sourceIndex = sourceShotIndexes.get(reference.sourceShotId);
  if (reference.origin === "previous_timeline" && Number.isInteger(sourceIndex) && sourceIndex < shotIndex) {
    const distance = shotIndex - sourceIndex;
    score += Math.max(10, 100 - (distance * 10));
    reasons.push(distance === 1 ? "immediate_previous_timeline" : "previous_timeline");
  }
  if (reference.sceneId && reference.sceneId === shot.sceneId) { score += 35; reasons.push("same_scene"); }
  if (reference.actionBeatId && reference.actionBeatId === shot.actionBeatId) { score += 20; reasons.push("same_action_beat"); }
  const requiredCharacters = stringList(shot.characterIds);
  const coveredCharacters = requiredCharacters.filter((characterId) =>
    reference.entityIds.includes(characterId) || characterReferenceIds.get(characterId) === reference.referenceId,
  );
  if (coveredCharacters.length) { score += coveredCharacters.length * 45; reasons.push("character_coverage"); }
  const environmentSignature = signature(shot.spatialBlocking?.background || shot.environmentState);
  if (environmentSignature && reference.environmentSignature === environmentSignature) { score += 40; reasons.push("environment_coverage"); }
  if (reference.kind === "storyboard") { score += 10; reasons.push("storyboard_continuity"); }
  return { score, reasons, coveredCharacters, environmentCovered: reasons.includes("environment_coverage") || (reasons.includes("same_scene") && reference.kind === "storyboard") };
}

function chooseReferences(candidates, requiredCharacters, requireEnvironment, maximum) {
  const selected = [];
  const coveredCharacters = new Set();
  let environmentCovered = false;
  const remaining = [...candidates];
  while (selected.length < maximum && remaining.length) {
    remaining.sort((left, right) => {
      const leftNew = left.coveredCharacters.filter((id) => !coveredCharacters.has(id)).length + (left.environmentCovered && !environmentCovered ? 1 : 0);
      const rightNew = right.coveredCharacters.filter((id) => !coveredCharacters.has(id)).length + (right.environmentCovered && !environmentCovered ? 1 : 0);
      return rightNew - leftNew || right.score - left.score || left.referenceId.localeCompare(right.referenceId);
    });
    const candidate = remaining.shift();
    const addsCoverage = candidate.coveredCharacters.some((id) => !coveredCharacters.has(id)) || (candidate.environmentCovered && !environmentCovered);
    if (!addsCoverage && candidate.score <= 0 && selected.length) continue;
    selected.push(candidate);
    candidate.coveredCharacters.forEach((id) => coveredCharacters.add(id));
    environmentCovered ||= candidate.environmentCovered;
    if (coveredCharacters.size === requiredCharacters.length && (!requireEnvironment || environmentCovered) && selected.length >= 1) break;
  }
  return { selected, coveredCharacters: [...coveredCharacters], environmentCovered };
}

function appendReferencePrompt(shot, selection) {
  if (!selection.selectedReferences.length) return cleanString(shot?.renderPrompt, shot?.prompt);
  const refs = selection.selectedReferences.map((entry) => `${entry.referenceId} (${entry.reasons.join(", ")})`).join("; ");
  return `${cleanString(shot?.renderPrompt, shot?.prompt)}. First-frame references: ${refs}. Preserve referenced character identities and environmental geometry.`;
}

export function buildReferenceImageSelection({ plannedShots, referenceImages, characters, priorAssets, policy: policyInput } = {}) {
  const policy = normalizeReferenceSelectionPolicy(policyInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  const shotsById = new Map(source.map((shot) => [cleanString(shot?.shotId), shot]));
  const sourceShotIndexes = new Map(source.map((shot, index) => [cleanString(shot?.shotId), index]));
  const characterReferenceIds = new Map((Array.isArray(characters) ? characters : []).map((character) => [cleanString(character.id), cleanString(character.referenceImageId)]));
  const catalog = [
    ...explicitCatalog(referenceImages),
    ...(policy.includePreviousTimeline ? timelineCatalog(priorAssets, shotsById) : []),
  ].filter((reference) => reference.referenceId && reference.assetUrl);
  const issues = [];
  const selections = source.map((shot, shotIndex) => {
    const requiredCharacters = stringList(shot.characterIds);
    const environmentPresent = Boolean(signature(shot.spatialBlocking?.background || shot.environmentState));
    const candidates = catalog
      .map((reference) => ({ ...reference, ...candidateScore(reference, shot, shotIndex, sourceShotIndexes, characterReferenceIds) }))
      .filter((reference) => reference.score > 0 && (reference.origin !== "previous_timeline" || sourceShotIndexes.get(reference.sourceShotId) < shotIndex));
    const chosen = chooseReferences(candidates, requiredCharacters, environmentPresent, policy.maxReferencesPerShot);
    const missingCharacterIds = requiredCharacters.filter((id) => !chosen.coveredCharacters.includes(id));
    if (policy.requireCharacterCoverage && missingCharacterIds.length) issues.push({ severity: "error", code: "missing_character_reference_coverage", shotId: shot.shotId, characterIds: missingCharacterIds });
    if (policy.requireEnvironmentCoverage && environmentPresent && !chosen.environmentCovered) issues.push({ severity: "error", code: "missing_environment_reference_coverage", shotId: shot.shotId });
    const selectedReferences = chosen.selected.map(({ score, reasons, coveredCharacters, environmentCovered, ...reference }) => ({ ...reference, score, reasons, coveredCharacters, environmentCovered }));
    return {
      shotId: cleanString(shot.shotId),
      primaryReferenceId: selectedReferences[0]?.referenceId || "",
      selectedReferences,
      coverage: { requiredCharacterIds: requiredCharacters, coveredCharacterIds: chosen.coveredCharacters, environmentPresent, environmentCovered: chosen.environmentCovered },
    };
  });
  const selectionsByShotId = new Map(selections.map((selection) => [selection.shotId, selection]));
  const shots = source.map((shot) => {
    const selection = selectionsByShotId.get(shot.shotId);
    const firstFrameReferences = selection.selectedReferences.map((reference) => ({ referenceId: reference.referenceId, assetUrl: reference.assetUrl, kind: reference.kind }));
    const designed = { ...shot, referenceSelection: selection, primaryReference: firstFrameReferences[0] || null, firstFrameReferences };
    return { ...designed, renderPrompt: appendReferencePrompt(designed, selection) };
  });
  return {
    policy,
    catalog,
    selections,
    shots,
    issues,
    coverage: { shotCount: shots.length, selectedReferenceCount: selections.reduce((sum, selection) => sum + selection.selectedReferences.length, 0) },
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}
