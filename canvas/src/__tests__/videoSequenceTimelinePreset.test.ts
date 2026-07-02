import { applyCanvasFrontmatterPreset } from '@/features/parsers/canvasFrontmatterPreset'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testVideoSequenceTimelinePresetRespectsExplicitStoryboardRenderer() {
  const store = useGraphStore.getState()
  store.resetAll()
  store.setCanvasRenderMode('2d')
  store.setCanvas2dRenderer('d3')
  store.setBottomSurfaceTab('stats')
  store.setBottomSurfaceCollapsed(true)
  store.setFloatingPanelView('storyboardWidget')
  store.setFloatingPanelOpen(false)
  const changed = applyCanvasFrontmatterPreset({
    rawText: [
      '---',
      'kgCanvasSurfaceMode: "2d"',
      'kgCanvasRenderMode: "2d"',
      'kgCanvas2dRenderer: "storyboard"',
      'kgVideoSequenceTimeline: true',
      '---',
      '',
      '# Storyboard Video Agent Demo',
    ].join('\n'),
  })
  const next = useGraphStore.getState()
  if (
    !changed ||
    next.canvasRenderMode !== '2d' ||
    next.canvas2dRenderer !== 'storyboard' ||
    next.bottomSurfaceTab !== 'timeline' ||
    next.bottomSurfaceCollapsed === true ||
    next.floatingPanelView !== 'timeline' ||
    next.floatingPanelOpen !== true
  ) {
    throw new Error(`expected explicit Storyboard video-sequence preset to keep Storyboard while opening Timeline surfaces, got ${JSON.stringify({
      changed,
      canvasRenderMode: next.canvasRenderMode,
      canvas2dRenderer: next.canvas2dRenderer,
      bottomSurfaceTab: next.bottomSurfaceTab,
      bottomSurfaceCollapsed: next.bottomSurfaceCollapsed,
      floatingPanelView: next.floatingPanelView,
      floatingPanelOpen: next.floatingPanelOpen,
    })}`)
  }
}
