import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getStoryboardWidgetPanelChromeClassName, getStoryboardWidgetPanelSelectionChromeClassName } from '@/components/StoryboardWidget/storyboardWidgetPanelChromeClassName'

const readSource = (...parts: string[]): string => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')

export function testStoryboardWidgetSelectionChromeParity() {
  const panelChrome = getStoryboardWidgetPanelChromeClassName()
  const selectedChrome = getStoryboardWidgetPanelSelectionChromeClassName(true)
  if (panelChrome.includes('shadow')) {
    throw new Error('expected shared Card, Widget, and Rich Media chrome to remain shadowless')
  }
  if (!panelChrome.includes('bg-[var(--kg-media-panel-bg)]') || panelChrome.includes('bg-[var(--kg-panel-bg)]')) {
    throw new Error('expected shared Card, Widget, and Rich Media chrome to consume the opaque media surface token')
  }
  if (!selectedChrome || getStoryboardWidgetPanelSelectionChromeClassName(false)) {
    throw new Error('expected shared Storyboard panel selection chrome to be active only for selected surfaces')
  }
  if (!selectedChrome.includes('outline') || selectedChrome.includes('ring')) {
    throw new Error('expected selected Storyboard panel chrome to use a true outline without box-shadow rings')
  }

  const cardOverlay = readSource('components', 'StoryboardWidgetCanvas', 'StoryboardCardOverlayLayer2d.tsx')
  const richMediaSurface = readSource('components', 'useRichMediaPanelSurfaceState.ts')
  const richMediaTypes = readSource('components', 'RichMediaPanel.types.ts')
  const flowMediaOverlay = readSource('components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const storyboardCanvas = readSource('components', 'StoryboardCanvas.tsx')
  const graphMediaOverlay = readSource('components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx')

  if (!cardOverlay.includes('getStoryboardWidgetPanelSelectionChromeClassName(selected)')
    || !cardOverlay.includes("data-kg-storyboard-widget-selected={selected ? '1' : undefined}")) {
    throw new Error('expected Card and Widget selection to consume the shared panel selection chrome owner')
  }
  if (!richMediaTypes.includes('selected?: boolean')
    || !richMediaSurface.includes('getStoryboardWidgetPanelSelectionChromeClassName(showStoryboardWidgetChrome && props.selected === true)')
    || !richMediaSurface.includes("'data-kg-storyboard-widget-selected': showStoryboardWidgetChrome && props.selected === true ? '1' : undefined")) {
    throw new Error('expected Rich Media Panel to consume the same selected-state chrome and semantic selection marker')
  }
  for (const [owner, source, contract] of [
    ['Flow Canvas', flowMediaOverlay, 'selected={isSelected}'],
    ['Storyboard Canvas', storyboardCanvas, 'selected={props.selected}'],
    ['Graph Canvas', graphMediaOverlay, 'selected={selected}'],
  ] as const) {
    if (!source.includes(contract)) throw new Error(`expected ${owner} Rich Media selection to reach shared panel chrome`)
  }
}
