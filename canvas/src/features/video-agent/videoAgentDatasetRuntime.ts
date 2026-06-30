import {
  buildHorizontalVisualZones,
  countVisualDatasetZones,
  loadVisualAnnotationDataset,
  mergeVisualAnnotationDatasets,
  saveVisualAnnotationDataset,
  splitVisualAnnotationDataset,
  type VisualAnnotationDataset,
  type VisualAnnotationDatasetSaveResult,
  type VisualAnnotationDatasetSplit,
  type VisualZoneCountingTimeline,
} from '@/features/visual-annotation-engine/annotationDataset'
import { hashSignatureParts } from '@/lib/hash/signature'
import { buildVideoAgentWorkspaceOutputPath } from './videoAgentWorkspaceOutput'

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
  datasetOperationSummary: {
    loadedSamples: number
    splitSamples: VisualAnnotationDatasetSplit['summary']
    mergedSamples: number
    savedSamples: number
    zoneCountedFrames: number
  }
  visualDataset: VisualAnnotationDataset
  mergedVisualDataset: VisualAnnotationDataset
  datasetSplitSummary: VisualAnnotationDatasetSplit['summary']
  savedDatasetArtifact: VisualAnnotationDatasetSaveResult
  zoneCounting: VisualZoneCountingTimeline
}

export const VIDEO_AGENT_DATASET_ARTIFACT_PATHS = Object.freeze({
  datasetOperations: buildVideoAgentWorkspaceOutputPath('dataset-operations.json'),
  visualDataset: buildVideoAgentWorkspaceOutputPath('visual-dataset.json'),
} as const)

export const VIDEO_AGENT_DEFAULT_ZONE_LABELS = ['zone-a', 'zone-b', 'zone-c'] as const

const readNonEmpty = (value: unknown, fallback: string): string => {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function buildVideoAgentDatasetRuntime(args: {
  datasetId?: string
  frameBoundingBoxes: readonly VideoAgentDatasetFrameBox[]
  schemaVersion: string
  saveFilename?: string
  sourceUrl: string
  splitSeed?: string
  zoneLabels?: readonly string[]
}): VideoAgentDatasetRuntime {
  const datasetId = readNonEmpty(
    args.datasetId,
    `video-agent-dataset:${hashSignatureParts([args.schemaVersion, args.sourceUrl, String(args.frameBoundingBoxes.length)])}`,
  )
  const loaded = loadVisualAnnotationDataset({
    sourceUrl: args.sourceUrl,
    frameBoundingBoxes: args.frameBoundingBoxes,
  }, {
    datasetId,
    sourceKind: 'frame-boxes',
    sourceUrl: args.sourceUrl,
  })
  if (loaded.ok === false) {
    throw new Error(`video-agent visual dataset failed to load: ${loaded.reason}`)
  }
  const visualDataset = loaded.dataset
  const split = splitVisualAnnotationDataset(visualDataset, { seed: readNonEmpty(args.splitSeed, visualDataset.datasetId) })
  const mergedVisualDataset = mergeVisualAnnotationDatasets([split.splits.train, split.splits.validation, split.splits.test])
  const savedDatasetArtifact = saveVisualAnnotationDataset(mergedVisualDataset, {
    filename: readNonEmpty(args.saveFilename, VIDEO_AGENT_DATASET_ARTIFACT_PATHS.visualDataset),
  })
  const zoneCounting = countVisualDatasetZones(mergedVisualDataset, buildHorizontalVisualZones(
    Array.isArray(args.zoneLabels) && args.zoneLabels.length > 0 ? args.zoneLabels : VIDEO_AGENT_DEFAULT_ZONE_LABELS,
  ))
  return {
    datasetOperationSummary: {
      loadedSamples: visualDataset.samples.length,
      splitSamples: split.summary,
      mergedSamples: mergedVisualDataset.samples.length,
      savedSamples: savedDatasetArtifact.sampleCount,
      zoneCountedFrames: zoneCounting.frames.length,
    },
    visualDataset,
    mergedVisualDataset,
    datasetSplitSummary: split.summary,
    savedDatasetArtifact,
    zoneCounting,
  }
}
