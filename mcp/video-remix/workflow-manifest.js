import { buildVideoWorkflowCheckpoint } from "./workflow-control.js";

function completedAssetsPreserved(workflow, execution) {
  const assets = Array.isArray(execution?.assets) ? execution.assets : [];
  return workflow.reusedAssets.every((asset) =>
    assets.some((candidate) => candidate.shotId === asset.shotId),
  );
}

export function buildVideoWorkflowManifest(workflow, execution) {
  const checkpoint = buildVideoWorkflowCheckpoint(workflow, execution);
  return {
    schema: workflow.schema,
    sessionId: workflow.sessionId,
    action: workflow.action,
    revisionNumber: workflow.revisionNumber,
    creativePlan: workflow.creativePlan,
    longScript: workflow.longScript,
    storyboardDesign: workflow.storyboardDesign,
    multiCameraDesign: workflow.multiCameraDesign,
    referenceSelection: workflow.referenceSelection,
    imageGeneration: workflow.imageGeneration,
    imageConsistency: execution.imageConsistency || null,
    parallelShotPlan: workflow.parallelShotPlan,
    parallelShotExecution: execution.parallelShotExecution || null,
    multiAgentPipeline: checkpoint.multiAgentPipeline,
    narrative: workflow.narrative,
    continuity: workflow.continuity,
    negotiation: execution.negotiation || workflow.negotiation,
    context: workflow.context,
    renderGuard: workflow.renderGuard,
    resume: {
      reusedShotCount: workflow.reusedAssets.length,
      pendingShotCount: workflow.pendingShots.length,
    },
    retryTrace: execution.retryTrace,
    checkpoint,
  };
}

export function buildVideoWorkflowGuardrails(workflow, execution, renderProviderCalls) {
  return {
    landscapeReferencesGuardRender: workflow.renderGuard.ok || renderProviderCalls === 0,
    completedShotsAreNotRerendered: completedAssetsPreserved(workflow, execution),
    narrativeDependenciesResolve: workflow.narrative.coherence.ok,
    longScriptContentRetained: workflow.narrative.scriptRetention.ok,
    expressiveStoryboardValid: workflow.storyboardDesign.ok || renderProviderCalls === 0,
    multiCameraContinuityValid: workflow.multiCameraDesign.ok || renderProviderCalls === 0,
    referenceCoverageValid: workflow.referenceSelection.ok || renderProviderCalls === 0,
    imagePromptsSpatiallyGrounded: workflow.imageGeneration.ok || renderProviderCalls === 0,
    selectedFirstFramesConsistent: execution.imageConsistency?.ok !== false || renderProviderCalls === 0,
    parallelShotScheduleValid: workflow.parallelShotPlan.ok || renderProviderCalls === 0,
    multiAgentPipelineValid: workflow.multiAgentPipeline?.validation?.ok !== false,
    continuityErrorsBlockRender: workflow.continuity.ok || renderProviderCalls === 0,
    specialistNegotiationBounded: (execution.negotiation || workflow.negotiation).bounded === true,
  };
}

export function buildVideoWorkflowValidationChecks(workflow, execution, renderProviderCalls) {
  const guardrails = buildVideoWorkflowGuardrails(workflow, execution, renderProviderCalls);
  return [
    { id: "landscape_reference_guard_blocks_render", ok: guardrails.landscapeReferencesGuardRender },
    { id: "resume_reuses_completed_shots", ok: guardrails.completedShotsAreNotRerendered },
    { id: "narrative_dependencies_resolve", ok: guardrails.narrativeDependenciesResolve },
    { id: "long_script_plot_and_dialogue_retained", ok: guardrails.longScriptContentRetained },
    { id: "expressive_storyboard_uses_canonical_cinematography", ok: guardrails.expressiveStoryboardValid },
    { id: "multi_camera_preserves_scene_blocking_and_background", ok: guardrails.multiCameraContinuityValid },
    { id: "first_frame_references_cover_required_entities", ok: guardrails.referenceCoverageValid },
    { id: "image_prompts_follow_reference_and_spatial_order", ok: guardrails.imagePromptsSpatiallyGrounded },
    { id: "parallel_candidates_select_consistent_first_frame", ok: guardrails.selectedFirstFramesConsistent },
    { id: "same_camera_shots_use_bounded_parallel_batches", ok: guardrails.parallelShotScheduleValid },
    { id: "multi_agent_pipeline_handoffs_form_valid_dag", ok: guardrails.multiAgentPipelineValid },
    { id: "continuity_errors_block_render", ok: guardrails.continuityErrorsBlockRender },
    { id: "specialist_negotiation_is_bounded", ok: guardrails.specialistNegotiationBounded },
  ];
}
