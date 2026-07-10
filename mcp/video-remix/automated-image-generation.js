import { cleanString } from "./helpers.js";

export const DEFAULT_NEAR_DISTANCE = 2.5;
export const DEFAULT_COORDINATE_PRECISION = 2;

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringList(value) {
  return Array.isArray(value) ? [...new Set(value.map((entry) => cleanString(entry)).filter(Boolean))] : [];
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function normalizeImagePromptPolicy(value = {}) {
  const input = plainRecord(value);
  const precision = Math.floor(finiteNumber(input.coordinatePrecision, DEFAULT_COORDINATE_PRECISION));
  const nearDistance = finiteNumber(input.nearDistance, DEFAULT_NEAR_DISTANCE);
  return {
    enabled: input.enabled !== false,
    includePreviousTimeline: input.includePreviousTimeline !== false,
    includeReferenceDirectives: input.includeReferenceDirectives !== false,
    requireSpatialBlocking: input.requireSpatialBlocking === true,
    coordinatePrecision: Math.max(0, Math.min(4, precision)),
    nearDistance: Math.max(0.1, Math.min(100, nearDistance)),
  };
}

function normalizePoint(value, precision) {
  const point = plainRecord(value);
  const round = (number) => Number(finiteNumber(number).toFixed(precision));
  return { x: round(point.x), y: round(point.y), z: round(point.z), facingDegrees: round(point.facingDegrees) };
}

function characterName(characterId, charactersById) {
  return cleanString(charactersById.get(characterId)?.name, characterId);
}

function positionPhrase(characterId, point, charactersById) {
  return `${characterName(characterId, charactersById)} at (${point.x}, ${point.y}, ${point.z}), facing ${point.facingDegrees} degrees`;
}

function pairwiseRelationships(characterEntries, charactersById, nearDistance) {
  const relationships = [];
  for (let leftIndex = 0; leftIndex < characterEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < characterEntries.length; rightIndex += 1) {
      const [leftId, left] = characterEntries[leftIndex];
      const [rightId, right] = characterEntries[rightIndex];
      const horizontal = right.x - left.x;
      const depth = right.z - left.z;
      const distance = Math.hypot(horizontal, right.y - left.y, depth);
      const lateral = Math.abs(horizontal) < 0.001 ? "aligned horizontally with" : horizontal > 0 ? "left of" : "right of";
      const depthOrder = Math.abs(depth) < 0.001 ? "at the same depth as" : depth > 0 ? "in front of" : "behind";
      const proximity = distance <= nearDistance ? "within interaction distance of" : "separated from";
      relationships.push(`${characterName(leftId, charactersById)} is ${lateral}, ${depthOrder}, and ${proximity} ${characterName(rightId, charactersById)}`);
    }
  }
  return relationships;
}

function environmentPhrase(background) {
  const entries = Object.entries(stableValue(plainRecord(background)));
  if (!entries.length) return "Keep the authored scene environment and its stable geometry";
  return `Environment anchors: ${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(", ")}`;
}

function promptInputKey({ shot, selection, previousShot, charactersById, policy }) {
  const characterIds = stringList(shot.characterIds).length
    ? stringList(shot.characterIds)
    : Object.keys(plainRecord(shot.spatialBlocking?.characters));
  return JSON.stringify(stableValue({
    policy,
    prompt: sourceRenderPrompt(shot),
    spatialBlocking: shot.spatialBlocking,
    environmentState: shot.environmentState,
    cameraAssignment: shot.cameraAssignment,
    references: (selection?.selectedReferences || []).map((reference) => ({ referenceId: reference.referenceId, sourceShotId: reference.sourceShotId })),
    previousShot: previousShot ? { shotId: previousShot.shotId, spatialBlocking: previousShot.spatialBlocking } : null,
    characters: characterIds.map((characterId) => charactersById.get(characterId) || { id: characterId }),
  }));
}

function previousSourceShot(selection, shotsById, currentIndex, shotIndexes) {
  const timelineReference = (selection?.selectedReferences || []).find((reference) =>
    reference.origin === "previous_timeline" && shotIndexes.get(reference.sourceShotId) < currentIndex,
  );
  return timelineReference ? shotsById.get(timelineReference.sourceShotId) : null;
}

function temporalDirectives(previousShot, currentCharacters, charactersById, precision) {
  if (!previousShot) return [];
  const previousCharacters = plainRecord(previousShot.spatialBlocking?.characters);
  return Object.entries(currentCharacters).flatMap(([characterId, currentPoint]) => {
    if (!previousCharacters[characterId]) return [];
    const previousPoint = normalizePoint(previousCharacters[characterId], precision);
    const samePosition = JSON.stringify(previousPoint) === JSON.stringify(currentPoint);
    const name = characterName(characterId, charactersById);
    return [samePosition
      ? `${name} maintains the previous timeline position and facing`
      : `${name} moves logically from (${previousPoint.x}, ${previousPoint.y}, ${previousPoint.z}) to (${currentPoint.x}, ${currentPoint.y}, ${currentPoint.z})`];
  });
}

function referenceDirective(selection) {
  const references = selection?.selectedReferences || [];
  if (!references.length) return "";
  return `Condition the first frame on ${references.map((reference) => reference.referenceId).join(", ")}; preserve referenced identities, wardrobe, props, and environmental geometry`;
}

function sourceRenderPrompt(shot) {
  return Object.hasOwn(plainRecord(shot), "preImageRenderPrompt")
    ? cleanString(shot.preImageRenderPrompt)
    : cleanString(shot.renderPrompt, shot.prompt);
}

function buildShotImagePrompt({ shot, selection, previousShot, charactersById, policy }) {
  const currentCharacters = Object.fromEntries(Object.entries(plainRecord(shot.spatialBlocking?.characters))
    .map(([characterId, point]) => [characterId, normalizePoint(point, policy.coordinatePrecision)]));
  const characterEntries = Object.entries(currentCharacters);
  const placement = characterEntries.map(([characterId, point]) => positionPhrase(characterId, point, charactersById));
  const interactions = pairwiseRelationships(characterEntries, charactersById, policy.nearDistance);
  const timeline = policy.includePreviousTimeline
    ? temporalDirectives(previousShot, currentCharacters, charactersById, policy.coordinatePrecision)
    : [];
  const directives = [
    sourceRenderPrompt(shot),
    policy.includeReferenceDirectives && referenceDirective(selection),
    environmentPhrase(shot.spatialBlocking?.background || shot.environmentState),
    placement.length && `Spatial placement: ${placement.join("; ")}`,
    interactions.length && `Character interaction geometry: ${interactions.join("; ")}`,
    timeline.length && `Previous-timeline continuity: ${timeline.join("; ")}`,
    "Compose a coherent first frame with believable scale, occlusion, sightlines, contact, and clearance between characters and environment anchors",
  ].filter(Boolean);
  return { prompt: directives.join(". "), placement, interactions, timeline, environment: plainRecord(shot.spatialBlocking?.background || shot.environmentState) };
}

export function buildAutomatedImageGeneration({ plannedShots, characters, referenceSelection, priorGeneration, policy: policyInput } = {}) {
  const policy = normalizeImagePromptPolicy(policyInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  if (!policy.enabled) return { policy, prompts: [], shots: source, issues: [], coverage: { promptCount: 0 }, ok: true };
  const shotsById = new Map(source.map((shot) => [cleanString(shot.shotId), shot]));
  const shotIndexes = new Map(source.map((shot, index) => [cleanString(shot.shotId), index]));
  const selectionsByShotId = new Map((referenceSelection?.selections || []).map((selection) => [cleanString(selection.shotId), selection]));
  const charactersById = new Map((Array.isArray(characters) ? characters : []).map((character) => [cleanString(character.id), character]));
  const priorPromptsByShotId = new Map((priorGeneration?.prompts || []).map((prompt) => [cleanString(prompt.shotId), prompt]));
  const issues = [];
  const prompts = source.map((shot, index) => {
    const selection = selectionsByShotId.get(cleanString(shot.shotId));
    const characterBlocking = plainRecord(shot.spatialBlocking?.characters);
    const environment = plainRecord(shot.spatialBlocking?.background || shot.environmentState);
    if (policy.requireSpatialBlocking && !Object.keys(characterBlocking).length && !Object.keys(environment).length) {
      issues.push({ severity: "error", code: "missing_image_prompt_spatial_blocking", shotId: shot.shotId });
    }
    const previousShot = previousSourceShot(selection, shotsById, index, shotIndexes);
    const inputKey = promptInputKey({ shot, selection, previousShot, charactersById, policy });
    const priorPrompt = priorPromptsByShotId.get(cleanString(shot.shotId));
    if (priorPrompt?.inputKey === inputKey && cleanString(priorPrompt.imagePrompt)) return { ...priorPrompt, reused: true };
    const generated = buildShotImagePrompt({ shot, selection, previousShot, charactersById, policy });
    return {
      shotId: cleanString(shot.shotId),
      sourceShotId: cleanString(previousShot?.shotId),
      referenceIds: (selection?.selectedReferences || []).map((reference) => reference.referenceId),
      imagePrompt: generated.prompt,
      inputKey,
      reused: false,
      spatialPlan: { placement: generated.placement, interactions: generated.interactions, timeline: generated.timeline, environment: generated.environment },
    };
  });
  const promptsByShotId = new Map(prompts.map((prompt) => [prompt.shotId, prompt]));
  const shots = source.map((shot) => {
    const imageGeneration = promptsByShotId.get(cleanString(shot.shotId));
    return { ...shot, preImageRenderPrompt: sourceRenderPrompt(shot), imageGeneration, imagePrompt: imageGeneration.imagePrompt, renderPrompt: imageGeneration.imagePrompt };
  });
  return {
    policy,
    prompts,
    shots,
    issues,
    coverage: { promptCount: prompts.length, reusedPromptCount: prompts.filter((prompt) => prompt.reused).length, priorTimelineConditionedCount: prompts.filter((prompt) => prompt.sourceShotId).length },
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}
