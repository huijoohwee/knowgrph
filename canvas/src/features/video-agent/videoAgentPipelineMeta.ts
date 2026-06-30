import type {
  VideoAgentCapability,
  VideoAgentPipelineStage,
  VideoAgentReasoningArtifact,
} from '@/features/video-agent/videoAgentPipeline'

export const DEFAULT_CAPABILITIES: readonly VideoAgentCapability[] = [
  'ingest',
  'parse',
  'annotate',
  'dataset',
  'zone_count',
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
  annotate: {
    phase: 'parsing',
    label: 'Annotate frames',
    output: 'frame-by-frame bounding boxes and annotation tasks',
  },
  dataset: {
    phase: 'parsing',
    label: 'Build dataset',
    output: 'loaded, split, merged, and saved visual annotation dataset',
  },
  zone_count: {
    phase: 'parsing',
    label: 'Count zones',
    output: 'frame-ordered real-time zone counting timeline',
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
  annotate: {
    task: 'Convert parsed frame evidence into normalized visual annotations.',
    decision: 'Use native frameBoundingBoxes as annotation data so downstream dataset and zone-counting owners do not depend on an external annotation runtime.',
    evidence: 'frameBoundingBoxes, labels, confidence, normalized bbox coordinates',
    outputArtifact: 'video-agent/frame-boxes.json',
    streamSignal: 'annotations-ready',
  },
  dataset: {
    task: 'Load annotations into a visual dataset, split it, merge it, and save the merged artifact.',
    decision: 'Run dataset operations through the native visual annotation dataset owner to keep load/split/merge/save deterministic.',
    evidence: 'visualDataset, datasetSplitSummary, mergedVisualDataset, savedDatasetArtifact',
    outputArtifact: 'video-agent/visual-dataset.json',
    streamSignal: 'dataset-ready',
  },
  zone_count: {
    task: 'Count frame detections against normalized visual zones in timeline order.',
    decision: 'Emit cumulative counts from the merged dataset so timeline playback can consume a single frame-ordered zone-counting payload.',
    evidence: 'zoneCounting.frames, zoneCounting.totals',
    outputArtifact: 'video-agent/zone-counts.json',
    streamSignal: 'zone-counts-ready',
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
