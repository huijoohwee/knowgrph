import { cleanString } from "./helpers.js";
import { normalizeMultiCameraProfile } from "./multi-camera-simulation.js";

export const CINEMATOGRAPHY_GRAMMAR = Object.freeze({
  shotSizes: Object.freeze(["extreme-wide", "wide", "medium-wide", "medium", "close-up", "extreme-close-up"]),
  cameraAngles: Object.freeze(["eye-level", "high-angle", "low-angle", "overhead", "dutch-angle", "over-the-shoulder"]),
  cameraMovements: Object.freeze(["locked", "pan", "tilt", "dolly-in", "dolly-out", "tracking", "crane", "handheld"]),
  compositions: Object.freeze(["balanced", "centered", "rule-of-thirds", "leading-lines", "deep-focus", "shallow-focus", "silhouette"]),
  transitions: Object.freeze(["cut", "match-cut", "dissolve", "fade", "whip-pan"]),
  paces: Object.freeze(["contemplative", "measured", "dynamic", "accelerating"]),
});

export const DEFAULT_STORYBOARD_PACE = "measured";
export const DEFAULT_MIN_SHOT_DURATION_SECONDS = 2;
export const DEFAULT_MAX_SHOT_DURATION_SECONDS = 8;

const PACE_DURATION_FACTOR = Object.freeze({ contemplative: 1, measured: 0.72, dynamic: 0.42, accelerating: 0.68 });

function stringList(value) {
  return Array.isArray(value) ? value.map((entry) => cleanString(entry)).filter(Boolean) : [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeStoryboardProfile(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const audience = input.targetAudience && typeof input.targetAudience === "object" && !Array.isArray(input.targetAudience)
    ? input.targetAudience
    : {};
  const requestedPace = cleanString(input.pace, DEFAULT_STORYBOARD_PACE);
  const pace = CINEMATOGRAPHY_GRAMMAR.paces.includes(requestedPace) ? requestedPace : DEFAULT_STORYBOARD_PACE;
  const minSeconds = Math.max(0.5, finiteNumber(input.shotDuration?.minSeconds, DEFAULT_MIN_SHOT_DURATION_SECONDS));
  const maxSeconds = Math.max(minSeconds, finiteNumber(input.shotDuration?.maxSeconds, DEFAULT_MAX_SHOT_DURATION_SECONDS));
  return {
    userRequirements: cleanString(input.userRequirements),
    targetAudience: {
      description: cleanString(audience.description),
      viewingContext: cleanString(audience.viewingContext),
      accessibilityNeeds: stringList(audience.accessibilityNeeds),
      contentSensitivities: stringList(audience.contentSensitivities),
    },
    tone: cleanString(input.tone),
    visualStyle: cleanString(input.visualStyle),
    aspectRatio: cleanString(input.aspectRatio),
    pace,
    motionIntensity: Math.max(0, Math.min(1, finiteNumber(input.motionIntensity, 0.5))),
    shotDuration: { minSeconds, maxSeconds },
    multiCamera: normalizeMultiCameraProfile(input.multiCamera),
    invalidPace: requestedPace === pace ? "" : requestedPace,
  };
}

function defaultIntensity(index, count, pace) {
  const progress = count <= 1 ? 0.5 : index / (count - 1);
  if (pace === "accelerating") return 0.25 + (progress * 0.7);
  if (pace === "dynamic") return index % 2 === 0 ? 0.45 : 0.8;
  if (pace === "contemplative") return 0.3 + (Math.sin(progress * Math.PI) * 0.2);
  return 0.35 + (Math.sin(progress * Math.PI) * 0.45);
}

function defaultTechnique({ index, count, intensity, hasDialogue, motionIntensity }) {
  if (index === 0) {
    return { shotSize: "wide", cameraAngle: "eye-level", cameraMovement: "locked", composition: "deep-focus", transition: "cut" };
  }
  if (index === count - 1) {
    return { shotSize: "wide", cameraAngle: "eye-level", cameraMovement: "dolly-out", composition: "balanced", transition: "fade" };
  }
  if (hasDialogue) {
    return { shotSize: "medium", cameraAngle: "over-the-shoulder", cameraMovement: "locked", composition: "shallow-focus", transition: "cut" };
  }
  if (motionIntensity <= 0.2) {
    return { shotSize: "medium-wide", cameraAngle: "eye-level", cameraMovement: "locked", composition: "balanced", transition: "cut" };
  }
  if (intensity >= 0.72) {
    return { shotSize: "close-up", cameraAngle: "low-angle", cameraMovement: "dolly-in", composition: "leading-lines", transition: "match-cut" };
  }
  return { shotSize: "medium-wide", cameraAngle: "eye-level", cameraMovement: "tracking", composition: "rule-of-thirds", transition: "cut" };
}

function audienceDirection(profile) {
  return [
    profile.targetAudience.description && `Audience: ${profile.targetAudience.description}`,
    profile.targetAudience.viewingContext && `Viewing context: ${profile.targetAudience.viewingContext}`,
    profile.targetAudience.accessibilityNeeds.length && `Accessibility: ${profile.targetAudience.accessibilityNeeds.join(", ")}`,
  ].filter(Boolean).join("; ");
}

function creativeDirection(profile) {
  return [
    profile.userRequirements,
    profile.tone && `Tone: ${profile.tone}`,
    profile.visualStyle && `Visual style: ${profile.visualStyle}`,
    profile.aspectRatio && `Aspect ratio: ${profile.aspectRatio}`,
  ].filter(Boolean).join("; ");
}

function resolveGrammarValue({ shot, field, group, fallback, shotId, issues }) {
  const authored = cleanString(shot?.cinematography?.[field]);
  if (!authored) return fallback;
  if (CINEMATOGRAPHY_GRAMMAR[group].includes(authored)) return authored;
  issues.push({ severity: "error", code: "unsupported_cinematography_term", shotId, field, value: authored });
  return fallback;
}

function durationFor(profile, intensity, index, count) {
  const { minSeconds, maxSeconds } = profile.shotDuration;
  const paceFactor = PACE_DURATION_FACTOR[profile.pace];
  const acceleratingFactor = profile.pace === "accelerating" && count > 1 ? 1 - ((index / (count - 1)) * 0.5) : 1;
  const expressiveFactor = 1 - (intensity * 0.25);
  return Number(Math.max(minSeconds, Math.min(maxSeconds, maxSeconds * paceFactor * acceleratingFactor * expressiveFactor)).toFixed(2));
}

function dramaticPurpose(shot, index, count, intensity) {
  const authored = cleanString(shot?.dramaticPurpose);
  if (authored) return authored;
  if (index === 0) return "establish";
  if (index === count - 1) return "resolve";
  if (intensity >= 0.72) return "escalate";
  return "develop";
}

export function buildCinematographyRenderPrompt(shot) {
  const design = shot?.cinematography;
  if (!design) return cleanString(shot?.prompt);
  const direction = [
    `${design.shotSize} shot`,
    design.cameraAngle,
    design.cameraMovement,
    `${design.composition} composition`,
    `${design.transition} transition`,
    `${design.durationSeconds}s`,
  ].filter(Boolean).join(", ");
  return [cleanString(shot?.prompt), direction, cleanString(design.lightingIntent), cleanString(design.creativeIntent), cleanString(design.audienceRationale)]
    .filter(Boolean)
    .join(". ");
}

export function resolveShotRenderPrompt(shot) {
  return cleanString(shot?.renderPrompt, shot?.prompt);
}

export function buildExpressiveStoryboard({ plannedShots, profile: profileInput } = {}) {
  const profile = normalizeStoryboardProfile(profileInput);
  const source = Array.isArray(plannedShots) ? plannedShots : [];
  const issues = profile.invalidPace
    ? [{ severity: "error", code: "unsupported_storyboard_pace", value: profile.invalidPace }]
    : [];
  const shots = source.map((shot, index) => {
    const shotId = cleanString(shot?.shotId);
    const defaultShotIntensity = (defaultIntensity(index, source.length, profile.pace) * 0.7) + (profile.motionIntensity * 0.3);
    const intensity = Math.max(0, Math.min(1, finiteNumber(shot?.dramaticIntensity, defaultShotIntensity)));
    const fallback = defaultTechnique({ index, count: source.length, intensity, hasDialogue: shot?.dialogueUnitIds?.length > 0, motionIntensity: profile.motionIntensity });
    const cinematography = {
      shotSize: resolveGrammarValue({ shot, field: "shotSize", group: "shotSizes", fallback: fallback.shotSize, shotId, issues }),
      cameraAngle: resolveGrammarValue({ shot, field: "cameraAngle", group: "cameraAngles", fallback: fallback.cameraAngle, shotId, issues }),
      cameraMovement: resolveGrammarValue({ shot, field: "cameraMovement", group: "cameraMovements", fallback: fallback.cameraMovement, shotId, issues }),
      composition: resolveGrammarValue({ shot, field: "composition", group: "compositions", fallback: fallback.composition, shotId, issues }),
      transition: resolveGrammarValue({ shot, field: "transition", group: "transitions", fallback: fallback.transition, shotId, issues }),
      lightingIntent: cleanString(shot?.cinematography?.lightingIntent),
      creativeIntent: cleanString(shot?.cinematography?.creativeIntent, creativeDirection(profile)),
      durationSeconds: durationFor(profile, intensity, index, source.length),
      audienceRationale: cleanString(shot?.cinematography?.audienceRationale, audienceDirection(profile)),
    };
    const designed = {
      ...shot,
      dramaticPurpose: dramaticPurpose(shot, index, source.length, intensity),
      dramaticIntensity: Number(intensity.toFixed(3)),
      cinematography,
    };
    return { ...designed, durationS: cinematography.durationSeconds, renderPrompt: buildCinematographyRenderPrompt(designed) };
  });
  const totalDurationSeconds = Number(shots.reduce((sum, shot) => sum + shot.cinematography.durationSeconds, 0).toFixed(2));
  return {
    profile,
    grammar: CINEMATOGRAPHY_GRAMMAR,
    shots,
    rhythm: {
      pace: profile.pace,
      beatCount: shots.length,
      totalDurationSeconds,
      intensityCurve: shots.map((shot) => ({ shotId: shot.shotId, intensity: shot.dramaticIntensity, durationSeconds: shot.durationS })),
    },
    issues,
    ok: issues.every((issue) => issue.severity !== "error"),
  };
}
