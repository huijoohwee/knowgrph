import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testCanvasEmbedStoryboardPreviewUsesSharedStoryboardSurface(): void {
  const viewport = readFileSync(resolve(process.cwd(), 'src/components/CanvasViewport.tsx'), 'utf8')
  const heroRuntime = readFileSync(resolve(process.cwd(), 'src/features/canvas/useKnowgrphLiveCanvasHero.ts'), 'utf8')
  for (const contract of [
    "get('kgCanvas2dRenderer')",
    'isCanvas2dRendererId(renderer)',
    "liveCanvasHeroEmbedPreviewSurface === 'storyboard'",
    '<StoryboardWidgetCanvasLazy active storyboardWidgetSurfaceId="storyboard" storyboardCardsMode />',
    'data-kg-live-canvas-hero-embed-surface={liveCanvasHeroEmbedPreviewSurface || \'flow\'}',
  ]) {
    if (!viewport.includes(contract)) throw new Error(`expected shared Storyboard embed preview contract ${contract}`)
  }
  if (!heroRuntime.includes('isRootAlias ? CANONICAL_WORKSPACE_README_CANVAS_EMBED_URL')) {
    throw new Error('expected every apex Dev origin to default to the canonical remote Storyboard iframe')
  }
}
