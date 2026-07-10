import fs from 'node:fs'
import path from 'node:path'

export function testStoryboardOverlayEdgesRetainNewerStableRevision() {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetOverlayEdges.ts'), 'utf8')
  if (!source.includes('stableGraphRevision > liveGraphRevision')) {
    throw new Error('expected a newer stable Storyboard graph revision to remain authoritative over stale live graph data')
  }
  if (!source.includes("pushOverlayEdgeTrace('schedule-newer-stable-revision'")) {
    throw new Error('expected newer stable revision reuse to remain traceable')
  }
}
