import { cleanString } from "./helpers.js";

export const CAMERA_COVERAGE_ROLES = Object.freeze(["master", "medium-coverage", "close-coverage", "reaction", "insert"]);
export const DEFAULT_MULTI_CAMERA_COUNT = 3;
export const DEFAULT_ACTION_AXIS_DEGREES = 0;
export const DEFAULT_MINIMUM_CUT_ANGLE_DEGREES = 30;

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDegrees(value) {
  return ((finiteNumber(value, 0) % 360) + 360) % 360;
}

function normalizePoint(value, fallbackIndex = 0) {
  const input = plainRecord(value);
  return {
    x: finiteNumber(input.x, fallbackIndex * 1.5),
    y: finiteNumber(input.y, 0),
    z: finiteNumber(input.z, 0),
    facingDegrees: normalizeDegrees(input.facingDegrees),
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableSignature(value) {
  return JSON.stringify(stableValue(value));
}

export function normalizeMultiCameraProfile(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: input.enabled !== false,
    cameraCount: Math.max(1, Math.min(8, Math.floor(finiteNumber(input.cameraCount, DEFAULT_MULTI_CAMERA_COUNT)))),
    actionAxisDegrees: normalizeDegrees(finiteNumber(input.actionAxisDegrees, DEFAULT_ACTION_AXIS_DEGREES)),
    minimumCutAngleDegrees: Math.max(0, Math.min(90, finiteNumber(input.minimumCutAngleDegrees, DEFAULT_MINIMUM_CUT_ANGLE_DEGREES))),
    allowAxisCrossing: input.allowAxisCrossing === true,
  };
}

function sceneIdFor(shot) {
  return cleanString(shot?.sceneId, cleanString(shot?.scriptSegmentIds?.[0], cleanString(shot?.actId, "scene-1")));
}

function actionBeatIdFor(shot, sceneId) {
  return cleanString(shot?.actionBeatId, cleanString(shot?.scriptUnitIds?.[0], sceneId));
}

function cameraOffset(index, count, spanDegrees) {
  if (count <= 1) return 0;
  return -(spanDegrees / 2) + ((spanDegrees * index) / (count - 1));
}

function buildSceneRig(sceneId, profile) {
  const primarySideSpan = 160;
  const maximumPrimaryCameras = profile.minimumCutAngleDegrees > 0
    ? Math.floor(primarySideSpan / profile.minimumCutAngleDegrees) + 1
    : profile.cameraCount;
  const effectiveCameraCount = profile.allowAxisCrossing ? profile.cameraCount : Math.min(profile.cameraCount, maximumPrimaryCameras);
  const spanDegrees = profile.allowAxisCrossing
    ? Math.min(330, Math.max(primarySideSpan, profile.minimumCutAngleDegrees * (effectiveCameraCount - 1)))
    : primarySideSpan;
  const cameras = Array.from({ length: effectiveCameraCount }, (_, index) => {
    const offsetDegrees = cameraOffset(index, effectiveCameraCount, spanDegrees);
    return {
      cameraId: `${sceneId}-camera-${index + 1}`,
      coverageRole: CAMERA_COVERAGE_ROLES[index % CAMERA_COVERAGE_ROLES.length],
      azimuthDegrees: normalizeDegrees(profile.actionAxisDegrees + offsetDegrees),
      elevationDegrees: index === 0 ? 0 : index % 2 === 0 ? 8 : -4,
      sideOfActionAxis: Math.abs(offsetDegrees) <= 90 ? "primary" : "opposite",
    };
  });
  return { sceneId, actionAxisDegrees: profile.actionAxisDegrees, allowAxisCrossing: profile.allowAxisCrossing, requestedCameraCount: profile.cameraCount, effectiveCameraCount, cameras };
}

function authoredCharacters(shot) {
  return plainRecord(shot?.spatialBlocking?.characters);
}

function resolveCharacterBlocking(shot, baseline) {
  const authored = authoredCharacters(shot);
  const characterIds = [...new Set([
    ...(Array.isArray(shot?.characterIds) ? shot.characterIds.map((id) => cleanString(id)).filter(Boolean) : []),
    ...Object.keys(authored).map((id) => cleanString(id)).filter(Boolean),
    ...Object.keys(baseline),
  ])];
  return Object.fromEntries(characterIds.map((characterId, index) => [
    characterId,
    characterId in authored ? normalizePoint(authored[characterId], index) : baseline[characterId] || normalizePoint({}, index),
  ]));
}

function backgroundFor(shot) {
  const authored = plainRecord(shot?.spatialBlocking?.background);
  if (Object.keys(authored).length) return stableValue(authored);
  const environment = plainRecord(shot?.environmentState);
  return Object.keys(environment).length ? stableValue(environment) : null;
}

function appendMultiCameraPrompt(shot, cameraAssignment, spatialBlocking) {
  const characterDirection = Object.entries(spatialBlocking.characters)
    .map(([characterId, point]) => `${characterId}@(${point.x},${point.y},${point.z}) facing ${point.facingDegrees}deg`)
    .join(", ");
  return [
    cleanString(shot?.renderPrompt, shot?.prompt),
    `Camera ${cameraAssignment.cameraId}: ${cameraAssignment.coverageRole}, azimuth ${cameraAssignment.azimuthDegrees}deg, elevation ${cameraAssignment.elevationDegrees}deg, remain on ${cameraAssignment.sideOfActionAxis} side of action axis`,
    characterDirection && `Preserve character blocking: ${characterDirection}`,
    `Preserve scene background: ${stableSignature(spatialBlocking.background)}`,
  ].filter(Boolean).join(". ");
}

export function buildMultiCameraSimulation({ plannedShots, profile: profileInput } = {}) {
  const profile = normalizeMultiCameraProfile(profileInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  if (!profile.enabled) {
    return { profile, sceneRigs: [], shots: source, issues: [], coverage: { sceneCount: 0, distinctCameraCount: 0 }, ok: true };
  }
  const sceneIds = [...new Set(source.map(sceneIdFor))];
  const rigsByScene = new Map(sceneIds.map((sceneId) => [sceneId, buildSceneRig(sceneId, profile)]));
  const sceneShotCounts = new Map();
  const beatBlocking = new Map();
  const sceneBackgrounds = new Map();
  const issues = [];
  const shots = source.map((shot) => {
    const sceneId = sceneIdFor(shot);
    const actionBeatId = actionBeatIdFor(shot, sceneId);
    const rig = rigsByScene.get(sceneId);
    const sceneShotIndex = sceneShotCounts.get(sceneId) || 0;
    sceneShotCounts.set(sceneId, sceneShotIndex + 1);
    const camera = rig.cameras[sceneShotIndex % rig.cameras.length];
    const requestedCameraId = cleanString(shot?.cameraId);
    if (requestedCameraId && !rig.cameras.some((entry) => entry.cameraId === requestedCameraId)) {
      issues.push({ severity: "error", code: "unknown_scene_camera", shotId: shot.shotId, sceneId, cameraId: requestedCameraId });
    }
    const cameraAssignment = rig.cameras.find((entry) => entry.cameraId === requestedCameraId) || camera;
    const beatKey = `${sceneId}:${actionBeatId}`;
    const baselineBlocking = beatBlocking.get(beatKey) || {};
    const characters = resolveCharacterBlocking(shot, baselineBlocking);
    if (beatBlocking.has(beatKey) && stableSignature(characters) !== stableSignature(baselineBlocking)) {
      issues.push({ severity: "error", code: "character_blocking_discontinuity", shotId: shot.shotId, sceneId, actionBeatId });
    } else if (!beatBlocking.has(beatKey)) {
      beatBlocking.set(beatKey, characters);
    }
    const authoredBackground = backgroundFor(shot);
    const baselineBackground = sceneBackgrounds.get(sceneId);
    const background = authoredBackground || baselineBackground || {};
    if (sceneBackgrounds.has(sceneId) && authoredBackground && stableSignature(background) !== stableSignature(baselineBackground)) {
      issues.push({ severity: "error", code: "scene_background_discontinuity", shotId: shot.shotId, sceneId });
    } else if (!sceneBackgrounds.has(sceneId)) {
      sceneBackgrounds.set(sceneId, background);
    }
    const spatialBlocking = { sceneId, actionBeatId, characters, background };
    const designed = { ...shot, sceneId, actionBeatId, cameraAssignment, spatialBlocking };
    return { ...designed, renderPrompt: appendMultiCameraPrompt(designed, cameraAssignment, spatialBlocking) };
  });
  const sceneRigs = [...rigsByScene.values()].map((rig) => ({
    ...rig,
    background: sceneBackgrounds.get(rig.sceneId) || {},
    actionBeatIds: [...new Set(shots.filter((shot) => shot.sceneId === rig.sceneId).map((shot) => shot.actionBeatId))],
  }));
  return {
    profile,
    sceneRigs,
    shots,
    issues,
    coverage: {
      sceneCount: sceneRigs.length,
      distinctCameraCount: new Set(shots.map((shot) => shot.cameraAssignment?.cameraId).filter(Boolean)).size,
      assignmentCount: shots.length,
    },
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}
