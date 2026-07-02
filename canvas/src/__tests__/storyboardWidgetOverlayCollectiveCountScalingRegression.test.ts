import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testStoryboardWidgetOverlayScalingUsesVisibleCollectiveCount = () => {
  const sharedPath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'flowWidgetOverlayShared.ts')
  const overlayInnerPath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorInner.tsx')
  const overlaySurfaceElementsPath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetOverlaySurfaceElements.tsx')
  const canvasSharedPath = path.resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'storyboardWidgetCanvasShared.tsx')

  const sharedText = readUtf8(sharedPath)
  const overlayInnerText = readUtf8(overlayInnerPath)
  const overlaySurfaceElementsText = readUtf8(overlaySurfaceElementsPath)
  const canvasSharedText = readUtf8(canvasSharedPath)

  if (!sharedText.includes('overlayCollectiveCount?: number')) {
    throw new Error('expected widget props to expose the visible overlay collective count')
  }
  if (!overlayInnerText.includes('const effectiveOverlayCollectiveCount = React.useMemo(() => {')) {
    throw new Error('expected widget placement runtime to derive an effective visible overlay collective count')
  }
  if (!overlayInnerText.includes('openWidgetNodeCount: effectiveOverlayCollectiveCount')) {
    throw new Error('expected widget placement runtime to scale against the visible overlay collective count instead of openWidgetNodeIds only')
  }
  if (!overlaySurfaceElementsText.includes('overlayCollectiveCount={args.overlayEditorNodeIds.length}')) {
    throw new Error('expected Storyboard Widget overlay surface to pass the visible overlay collective count into each widget overlay')
  }
  if (!canvasSharedText.includes('overlayCollectiveCount?: number')) {
    throw new Error('expected Storyboard Widget overlay wrapper props to carry the visible overlay collective count')
  }
  if (!canvasSharedText.includes('overlayCollectiveCount={args.overlayCollectiveCount}')) {
    throw new Error('expected Storyboard Widget overlay wrapper to forward the visible overlay collective count to WidgetEditor')
  }
}
