import { buildVideoAgentPipeline } from '@/features/video-agent'

export function testVideoAgentVisualAnnotationDatasetPreservesTracksAndMasks() {
  const result = buildVideoAgentPipeline({
    sourceUrl: 'https://example.test/operator-video.mp4',
    durationMs: 7000,
  })
  if (result.ok === false) throw new Error(`expected video-agent pipeline success, got ${result.errorCode}`)

  const detections = result.pipeline.frameBoundingBoxes.flatMap(box => box.detections)
  const detectionTrackIds = new Set(detections.map(detection => detection.trackId))
  if (
    !detectionTrackIds.has('video-agent-track-primary')
    || !detectionTrackIds.has('video-agent-track-secondary')
    || detections.some(detection => detection.mask.length < 3)
  ) {
    throw new Error(`expected frame detections to carry persistent track IDs and masks, got ${JSON.stringify(detections.slice(0, 2))}`)
  }

  const datasetAnnotations = result.pipeline.datasetRuntime.visualDataset.samples.flatMap(sample => sample.annotations)
  const datasetTrackIds = new Set(datasetAnnotations.map(annotation => annotation.trackId))
  if (
    !datasetTrackIds.has('video-agent-track-primary')
    || !datasetTrackIds.has('video-agent-track-secondary')
    || datasetAnnotations.some(annotation => !annotation.mask?.polygons.length)
  ) {
    throw new Error(`expected visual dataset to preserve video-agent track IDs and masks, got ${JSON.stringify(datasetAnnotations.slice(0, 2))}`)
  }
}
