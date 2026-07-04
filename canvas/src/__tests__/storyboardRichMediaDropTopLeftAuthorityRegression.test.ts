import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStoryboardRichMediaDropTopLeftAuthorityForbidsDoubleCenterCorrection() {
  const text = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidget/useWidgetPlacementRuntime.ts'), 'utf8')

  if (!text.includes("const storyboardRichMediaGraphWorldPreferred = String(storyboardWidgetSurfaceId || '').trim() === 'storyboard' && !!richMediaFrameSize && nx != null && ny != null")) {
    throw new Error('expected storyboard Rich Media overlays to prefer authored graph world coordinates over runtime scene coordinates when graph x/y are authoritative')
  }
  if (!text.includes('storyboardRichMediaGraphWorldPreferred') || !text.includes('? { x: nx, y: ny }')) {
    throw new Error('expected storyboard Rich Media overlays to read the placement base from graph-authored world coordinates before falling back to live runtime positions')
  }
  if (!text.includes('const richMediaAuthoritativeTopLeftScreenBase = richMediaFrameSize && hasAuthoritativeNodeWorldPos')) {
    throw new Error('expected Storyboard Rich Media overlay placement runtime to derive one top-left authoritative screen base for graph-anchored Rich Media panels')
  }
  if (!text.includes('? { top: screenY, left: screenX }')) {
    throw new Error('expected Storyboard Rich Media authoritative top-left screen base to preserve graph top-left projection without extra centering correction')
  }
  if (!text.includes('? richMediaAuthoritativeTopLeftScreenBase')) {
    throw new Error('expected Storyboard Rich Media floating placement to reuse the top-left authoritative screen base for graph-anchored drops')
  }
  if (!text.includes('&& !(richMediaFrameSize && hasAuthoritativeNodeWorldPos)')) {
    throw new Error('expected Storyboard Rich Media graph-anchored drops to bypass frontmatter screen-authority zoom projection once authoritative graph coordinates exist')
  }
}
