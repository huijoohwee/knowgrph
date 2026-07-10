import { cleanString } from "./helpers.js";
import { retrieveScriptUnits } from "./long-script-engine.js";

export const DEFAULT_SHOTS_PER_ACT = 4;
export const DEFAULT_RETRIEVAL_TOP_K = 3;

function tokens(value) {
  return new Set(cleanString(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function sourceText(source) {
  return [source?.title, source?.platform, source?.summary, source?.description, source?.text, ...(Array.isArray(source?.observedFields) ? source.observedFields : [])]
    .map((value) => cleanString(value))
    .filter(Boolean)
    .join(" ");
}

function tokenOverlapScore(query, candidate) {
  const queryTokens = tokens(query);
  if (queryTokens.size === 0) return 0;
  const candidateTokens = tokens(candidate);
  let matches = 0;
  queryTokens.forEach((token) => { if (candidateTokens.has(token)) matches += 1; });
  return matches / queryTokens.size;
}

export function retrieveNarrativeSources(query, sourceCards, options = {}) {
  const topK = Number.isFinite(Number(options.topK))
    ? Math.max(1, Math.floor(Number(options.topK)))
    : DEFAULT_RETRIEVAL_TOP_K;
  return (Array.isArray(sourceCards) ? sourceCards : [])
    .map((source) => ({
      sourceId: cleanString(source?.sourceId),
      score: tokenOverlapScore(query, sourceText(source)),
    }))
    .filter((entry) => entry.sourceId && entry.score > 0)
    .sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId))
    .slice(0, topK);
}

function normalizedDependencies(shot, index, shots) {
  const explicit = Array.isArray(shot?.dependencyShotIds)
    ? shot.dependencyShotIds.map((value) => cleanString(value)).filter(Boolean)
    : [];
  if (index > 0) explicit.unshift(cleanString(shots[index - 1]?.shotId));
  return [...new Set(explicit.filter(Boolean))];
}

export function buildHierarchicalNarrativePlan({ script, plannedShots, sourceCards, longScript, policy = {} } = {}) {
  const shots = Array.isArray(plannedShots) ? plannedShots : [];
  const shotsPerAct = Number.isFinite(Number(policy.shotsPerAct))
    ? Math.max(1, Math.floor(Number(policy.shotsPerAct)))
    : DEFAULT_SHOTS_PER_ACT;
  const sourceIds = new Set((Array.isArray(sourceCards) ? sourceCards : []).map((source) => cleanString(source?.sourceId)));
  const scenes = shots.map((shot, index) => {
    const explicitSourceIds = Array.isArray(shot?.sourceCardIds)
      ? shot.sourceCardIds.map((value) => cleanString(value)).filter((value) => sourceIds.has(value))
      : [];
    const retrieved = explicitSourceIds.length
      ? explicitSourceIds.map((sourceId) => ({ sourceId, score: 1 }))
      : retrieveNarrativeSources(`${script || ""} ${shot?.prompt || ""}`, sourceCards, { topK: policy.retrievalTopK });
    const mapping = longScript?.shotMappings?.find((entry) => entry.shotId === cleanString(shot?.shotId));
    const assignedSegmentIds = mapping?.segmentIds || [];
    const assignedUnitIds = (longScript?.segments || [])
      .filter((segment) => assignedSegmentIds.includes(segment.segmentId))
      .flatMap((segment) => segment.unitIds);
    const retrievedScriptUnits = retrieveScriptUnits(
      `${shot?.objective || ""} ${shot?.prompt || ""}`,
      longScript?.corpus,
      { topK: policy.scriptRetrievalTopK },
    );
    return {
      shotId: cleanString(shot?.shotId),
      actId: cleanString(shot?.actId, `act-${Math.floor(index / shotsPerAct) + 1}`),
      sceneId: cleanString(shot?.sceneId, cleanString(shot?.shotId)),
      objective: cleanString(shot?.objective, shot?.prompt),
      dependencies: normalizedDependencies(shot, index, shots),
      retrievedSources: retrieved,
      scriptSegmentIds: assignedSegmentIds,
      retainedScriptUnitIds: [...new Set(assignedUnitIds)],
      retrievedScriptUnits,
    };
  });
  const knownShotIds = new Set(scenes.map((scene) => scene.shotId));
  const unresolvedDependencies = scenes.flatMap((scene) =>
    scene.dependencies
      .filter((dependency) => !knownShotIds.has(dependency))
      .map((dependency) => ({ shotId: scene.shotId, dependencyShotId: dependency })),
  );
  const acts = [...new Set(scenes.map((scene) => scene.actId))].map((actId) => ({
    actId,
    sceneIds: scenes.filter((scene) => scene.actId === actId).map((scene) => scene.sceneId),
  }));
  const sourcedSceneCount = scenes.filter((scene) => scene.retrievedSources.length > 0).length;
  return {
    hierarchy: { story: { script: cleanString(script), actIds: acts.map((act) => act.actId) }, acts, scenes },
    retrieval: {
      sourceCount: sourceIds.size,
      sourcedSceneCount,
      coverage: scenes.length ? sourcedSceneCount / scenes.length : 1,
      scriptUnitCount: longScript?.corpus?.unitCount || 0,
      retrievedScriptUnitCount: new Set(scenes.flatMap((scene) => scene.retrievedScriptUnits.map((entry) => entry.unitId))).size,
    },
    scriptRetention: longScript?.retention || {
      plotBeatCoverage: 1,
      dialogueCoverage: 1,
      omittedPlotBeatIds: [],
      omittedDialogueIds: [],
      ok: true,
    },
    coherence: {
      ok: unresolvedDependencies.length === 0,
      unresolvedDependencies,
    },
  };
}

function normalizeStateObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [cleanString(key), typeof entry === "string" ? cleanString(entry) : entry])
      .filter(([key]) => key),
  );
}

function stateChanged(previous, current) {
  return JSON.stringify(previous) !== JSON.stringify(current);
}

export function buildVisualContinuityLedger({ plannedShots, characters, referenceImages } = {}) {
  const shots = Array.isArray(plannedShots) ? plannedShots : [];
  const characterRegistry = new Map((Array.isArray(characters) ? characters : []).map((character) => [character.id, character]));
  const referenceRegistry = new Map((Array.isArray(referenceImages) ? referenceImages : []).map((image) => [image.id, image]));
  const lastCharacterStates = new Map();
  let lastEnvironmentState = {};
  const issues = [];
  const states = shots.map((shot, index) => {
    const authoredCharacterStates = normalizeStateObject(shot?.characterStates);
    const activeCharacterIds = [...new Set([
      ...Object.keys(authoredCharacterStates),
      ...(Array.isArray(shot?.characterIds) ? shot.characterIds.map((value) => cleanString(value)).filter(Boolean) : []),
    ])];
    const characterStates = {};
    for (const characterId of activeCharacterIds) {
      if (!characterRegistry.has(characterId)) {
        issues.push({ severity: "error", code: "unknown_character", shotId: shot.shotId, characterId });
        continue;
      }
      const previous = lastCharacterStates.get(characterId) || {};
      const current = normalizeStateObject(authoredCharacterStates[characterId]);
      const resolved = Object.keys(current).length ? current : previous;
      if (index > 0 && stateChanged(previous, resolved) && !cleanString(shot?.transitionReason)) {
        issues.push({ severity: "warning", code: "unexplained_character_state_change", shotId: shot.shotId, characterId });
      }
      characterStates[characterId] = resolved;
      lastCharacterStates.set(characterId, resolved);
    }
    const authoredEnvironment = normalizeStateObject(shot?.environmentState);
    const environmentState = Object.keys(authoredEnvironment).length ? authoredEnvironment : lastEnvironmentState;
    if (index > 0 && stateChanged(lastEnvironmentState, environmentState) && !cleanString(shot?.transitionReason)) {
      issues.push({ severity: "warning", code: "unexplained_environment_change", shotId: shot.shotId });
    }
    lastEnvironmentState = environmentState;
    const referenceImageIds = activeCharacterIds
      .map((characterId) => cleanString(characterRegistry.get(characterId)?.referenceImageId))
      .filter((referenceId) => referenceRegistry.has(referenceId));
    return {
      shotId: cleanString(shot?.shotId),
      dependsOnShotId: index > 0 ? cleanString(shots[index - 1]?.shotId) : "",
      characterStates,
      environmentState,
      referenceImageIds,
    };
  });
  return {
    characterCount: characterRegistry.size,
    environmentBoundaryCount: Math.max(0, states.length - 1),
    states,
    issues,
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}
