export const VIDEO_SPECIALIST_ROLES = Object.freeze([
  "narrative_planner",
  "storyboard_designer",
  "camera_director",
  "reference_curator",
  "image_prompt_designer",
  "first_frame_reviewer",
  "render_scheduler",
  "continuity_supervisor",
  "visual_quality_reviewer",
  "production_director",
]);

export const DEFAULT_NEGOTIATION_ROUNDS = 2;

function proposal(agentId, status, findings = [], proposedRevisions = {}) {
  return { agentId, status, findings, proposedRevisions };
}

export function buildVideoAgentNegotiation({ narrative, continuity, storyboardDesign, multiCameraDesign, referenceSelection, imageGeneration, imageConsistency, parallelShotPlan, qualityReview, maxRounds } = {}) {
  const boundedRounds = Number.isFinite(Number(maxRounds))
    ? Math.max(1, Math.min(4, Math.floor(Number(maxRounds))))
    : DEFAULT_NEGOTIATION_ROUNDS;
  const proposals = [
    proposal(
      "narrative_planner",
      narrative?.coherence?.ok === false || narrative?.scriptRetention?.ok === false
        ? "block"
        : narrative?.retrieval?.coverage < 1 ? "revise" : "approve",
      [
        ...(narrative?.coherence?.unresolvedDependencies || []),
        ...(narrative?.scriptRetention?.omittedPlotBeatIds || []).map((unitId) => ({ code: "omitted_plot_beat", unitId })),
        ...(narrative?.scriptRetention?.omittedDialogueIds || []).map((unitId) => ({ code: "omitted_dialogue", unitId })),
        ...(narrative?.retrieval?.coverage < 1 ? [{ code: "incomplete_retrieval_coverage", coverage: narrative.retrieval.coverage }] : []),
      ],
    ),
    proposal(
      "storyboard_designer",
      storyboardDesign?.ok === false ? "block" : "approve",
      storyboardDesign?.issues || [],
    ),
    proposal(
      "camera_director",
      multiCameraDesign?.ok === false ? "block" : "approve",
      multiCameraDesign?.issues || [],
    ),
    proposal(
      "reference_curator",
      referenceSelection?.ok === false ? "block" : "approve",
      referenceSelection?.issues || [],
    ),
    proposal(
      "image_prompt_designer",
      imageGeneration?.ok === false ? "block" : "approve",
      imageGeneration?.issues || [],
    ),
    proposal(
      "first_frame_reviewer",
      imageConsistency?.ok === false ? "block" : imageConsistency?.status === "complete" ? "approve" : "pending",
      imageConsistency?.issues || [],
    ),
    proposal(
      "render_scheduler",
      parallelShotPlan?.ok === false ? "block" : "approve",
      parallelShotPlan?.issues || [],
    ),
    proposal(
      "continuity_supervisor",
      continuity?.ok === false ? "block" : continuity?.issues?.length ? "revise" : "approve",
      continuity?.issues || [],
    ),
    proposal(
      "visual_quality_reviewer",
      qualityReview?.status === "failed" ? "block" : qualityReview?.status === "revise" ? "revise" : qualityReview?.status === "complete" ? "approve" : "pending",
      qualityReview?.findings || [],
      qualityReview?.proposedRevisions || {},
    ),
  ];
  const hasBlock = proposals.some((entry) => entry.status === "block");
  const hasRevision = proposals.some((entry) => entry.status === "revise");
  const hasPending = proposals.some((entry) => entry.status === "pending");
  const decision = hasBlock ? "block" : hasRevision ? "revise" : hasPending ? "awaiting_visual_review" : "approve";
  proposals.push(proposal(
    "production_director",
    decision,
    proposals.flatMap((entry) => entry.findings),
    Object.assign({}, ...proposals.map((entry) => entry.proposedRevisions)),
  ));
  return {
    maxRounds: boundedRounds,
    roundsCompleted: 1,
    roles: VIDEO_SPECIALIST_ROLES,
    proposals,
    decision,
    proposedRevisions: proposals[proposals.length - 1].proposedRevisions,
    bounded: true,
  };
}
