import { buildVideoAgentPipeline } from '@/features/video-agent'
import { projectVideoAgentFrameAnalysisSrcDoc } from '@/features/video-agent/videoAgentFrameAnalysisProjection'

export function testVideoAgentFrameAnalysisProjectionUsesComponentRefinedBoxes() {
  const result = buildVideoAgentPipeline({
    sourceUrl: 'https://youtu.be/componentRefine01',
    requestedCapabilities: ['annotate', 'dataset', 'zone_count'],
  })
  if (result.ok === false) throw new Error(`expected video-agent pipeline, got ${result.reason}`)
  const frameUrl = result.pipeline.frameBoundingBoxes[0]?.frameImageUrl || ''
  const projected = projectVideoAgentFrameAnalysisSrcDoc({
    frameBoundingBoxes: result.pipeline.frameBoundingBoxes,
    srcDoc: `<main><section class="thumbnail"><img class="thumbnail-source" src="${frameUrl}" alt=""><section class="frame-boxes"></section></section></main>`,
  })
  for (const token of [
    'buildScoreMap',
    'readComponentCandidates',
    'component-refined',
    'readFrameComponents',
    'data-kg-video-agent-component-mark',
    'data-kg-video-agent-component-count',
    'data-kg-video-agent-bbox-refined',
    'data-kg-video-agent-detection-index="1"',
  ]) {
    if (!projected.includes(token)) {
      throw new Error(`expected frame-analysis projection to use component-refined multi-object boxes: ${token}`)
    }
  }
}
