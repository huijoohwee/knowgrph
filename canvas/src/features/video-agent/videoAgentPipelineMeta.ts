import type {
  VideoAgentCapability,
  VideoAgentPipelineStage,
  VideoAgentReasoningArtifact,
} from '@/features/video-agent/videoAgentPipeline'

export const DEFAULT_CAPABILITIES: readonly VideoAgentCapability[] = [
  'ingest',
  'parse',
  'search',
  'edit',
  'compile',
  'generate',
  'stream',
]

export const CAPABILITY_META: Record<VideoAgentCapability, { phase: VideoAgentPipelineStage['phase']; label: string; output: string }> = {
  ingest: {
    phase: 'ingestion',
    label: 'Ingest source',
    output: 'source manifest',
  },
  parse: {
    phase: 'parsing',
    label: 'Parse multimodal context',
    output: 'transcript windows, frame labels, annotations, and visual dataset rows',
  },
  search: {
    phase: 'parsing',
    label: 'Search moments',
    output: 'ranked evidence windows',
  },
  edit: {
    phase: 'parsing',
    label: 'Plan edits',
    output: 'clip ranges, overlays, subtitles, and pacing',
  },
  compile: {
    phase: 'rendering',
    label: 'Compile timeline',
    output: 'timeline manifest and render spec',
  },
  generate: {
    phase: 'rendering',
    label: 'Generate placeholders',
    output: 'generated overlays or narration placeholders',
  },
  stream: {
    phase: 'rendering',
    label: 'Stream result',
    output: 'videoUrl or outputSrcDoc rich-media payload',
  },
}

export const REASONING_META: Record<VideoAgentCapability, Omit<VideoAgentReasoningArtifact, 'capability'>> = {
  ingest: {
    task: 'Normalize the operator supplied media source into a reusable source manifest.',
    decision: 'Keep the URL as validation input and derive a semantic source key before downstream parsing.',
    evidence: 'sourceUrl, schemaVersion, sourceKey',
    outputArtifact: 'video-agent/source.json',
    streamSignal: 'source-ready',
  },
  parse: {
    task: 'Parse multimodal context into transcript windows, frame labels, annotation targets, and visual dataset rows.',
    decision: 'Represent parse output as typed data so search, editing, dataset save, and zone counting reuse it without recomputation.',
    evidence: 'frame labels, annotation tasks, transcript windows, dataset samples',
    outputArtifact: 'video-agent/parse.json',
    streamSignal: 'parse-ready',
  },
  search: {
    task: 'Search for task-relevant moments across transcript, frame, and annotation evidence.',
    decision: 'Rank moments as reusable evidence windows instead of binding to a provider-specific search API.',
    evidence: 'ranked evidence windows',
    outputArtifact: 'video-agent/moments.json',
    streamSignal: 'moments-ready',
  },
  edit: {
    task: 'Plan clip ranges, overlays, subtitles, pacing, and transitions.',
    decision: 'Store editing decisions as timeline data so rendering remains deterministic and inspectable.',
    evidence: 'clip ranges, overlay labels, subtitle cues',
    outputArtifact: 'video-agent/edit-plan.json',
    streamSignal: 'edit-ready',
  },
  compile: {
    task: 'Compile selected moments into a source-owned timeline and Render_Spec.',
    decision: 'Emit HTML/CSS/data for the existing HTML Video Renderer instead of adding a parallel renderer.',
    evidence: 'timeline tracks, composition dimensions, engine hint',
    outputArtifact: 'video-agent/render.html',
    streamSignal: 'render-spec-ready',
  },
  generate: {
    task: 'Plan generated overlays, narration, or visual treatments without requiring a live generation call.',
    decision: 'Use generation placeholders that can be filled by optional local tools under operator control.',
    evidence: 'overlay prompts, narration placeholders',
    outputArtifact: 'video-agent/generated-assets.json',
    streamSignal: 'generation-plan-ready',
  },
  stream: {
    task: 'Publish the compiled result to the connected Rich Media Panel immediately.',
    decision: 'Prefer video/mp4 when browser encoding succeeds and preserve outputSrcDoc fallback when it does not.',
    evidence: 'videoUrl, outputSrcDoc, renderJobId',
    outputArtifact: 'video-agent/stream-manifest.json',
    streamSignal: 'stream-ready',
  },
}
