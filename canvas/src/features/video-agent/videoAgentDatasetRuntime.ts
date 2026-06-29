import {
  buildHorizontalVisualZones,
  countVisualDatasetZones,
  loadVisualAnnotationDataset,
  saveVisualAnnotationDataset,
  splitVisualAnnotationDataset,
  type VisualAnnotationDataset,
  type VisualAnnotationDatasetSaveResult,
  type VisualAnnotationDatasetSplit,
  type VisualZoneCountingTimeline,
} from '@/features/visual-annotation-engine/annotationDataset'
import { hashSignatureParts } from '@/lib/hash/signature'

type VideoAgentDatasetFrameBox = {
  bbox: readonly [number, number, number, number]
  confidence: number
  evidence: string
  frameImageUrl: string
  frameIndex: number
  label: string
  timestampMs: number
}

export type VideoAgentDatasetRuntime = {
  visualDataset: VisualAnnotationDataset
  datasetSplitSummary: VisualAnnotationDatasetSplit['summary']
  savedDatasetArtifact: VisualAnnotationDatasetSaveResult
  zoneCounting: VisualZoneCountingTimeline
}

export function buildVideoAgentDatasetRuntime(args: {
  frameBoundingBoxes: readonly VideoAgentDatasetFrameBox[]
  schemaVersion: string
  sourceUrl: string
}): VideoAgentDatasetRuntime {
  const loaded = loadVisualAnnotationDataset({
    sourceUrl: args.sourceUrl,
    frameBoundingBoxes: args.frameBoundingBoxes,
  }, {
    datasetId: `video-agent-dataset:${hashSignatureParts([args.schemaVersion, args.sourceUrl, String(args.frameBoundingBoxes.length)])}`,
    sourceKind: 'frame-boxes',
    sourceUrl: args.sourceUrl,
  })
  if (loaded.ok === false) {
    throw new Error(`video-agent visual dataset failed to load: ${loaded.reason}`)
  }
  const visualDataset = loaded.dataset
  const split = splitVisualAnnotationDataset(visualDataset, { seed: visualDataset.datasetId })
  const savedDatasetArtifact = saveVisualAnnotationDataset(visualDataset, { filename: 'video-agent/visual-dataset.json' })
  const zoneCounting = countVisualDatasetZones(visualDataset, buildHorizontalVisualZones([
    'entry zone',
    'center zone',
    'exit zone',
  ]))
  return {
    visualDataset,
    datasetSplitSummary: split.summary,
    savedDatasetArtifact,
    zoneCounting,
  }
}
