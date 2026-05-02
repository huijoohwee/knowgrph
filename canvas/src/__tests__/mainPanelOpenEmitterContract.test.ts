import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import { emitMainPanelOpen, MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testEmitMainPanelOpenDispatchesSharedEvent = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const events: Array<Record<string, unknown>> = []
  const listener = (event: Event) => {
    const custom = event as CustomEvent<Record<string, unknown>>
    events.push(custom.detail || {})
  }
  dom.window.addEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)

  emitMainPanelOpen({
    tab: 'workflowManager',
    workflowManagerTab: 'mapping',
    searchQuery: 'textGeneration default',
  })
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const last = events[events.length - 1]
  if (!last) throw new Error('expected shared main-panel emitter to dispatch an event')
  if (String(last.tab || '') !== 'workflowManager') {
    throw new Error(`expected shared emitter to preserve tab detail, got ${JSON.stringify(last)}`)
  }
  if (String(last.workflowManagerTab || '') !== 'mapping') {
    throw new Error(`expected shared emitter to preserve workflowManagerTab detail, got ${JSON.stringify(last)}`)
  }
  if (String(last.searchQuery || '') !== 'textGeneration default') {
    throw new Error(`expected shared emitter to preserve searchQuery detail, got ${JSON.stringify(last)}`)
  }

  dom.window.removeEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)
}

export const testMainPanelOpenCallsitesUseSharedEmitter = () => {
  const files = [
    'src/components/FlowEditorCanvas/runtime/useFlowEditorOverlaySurface.tsx',
    'src/features/toolbar/GrabMapsDiscoveryWidgetSection.tsx',
    'src/features/canvas/CanvasQueryBootstrapRuntime.tsx',
    'src/features/panels/hooks/useHelpViewLogic.ts',
    'src/features/spotlight/LaunchSpotlightTourCard.tsx',
    'src/lib/markdown-core/ui/MarkdownMediaUi.impl.tsx',
    'src/components/BottomPanel/BottomPanelCuratorToolbar.tsx',
    'src/components/FlowEditor/NodeOverlayEditorActionsToolbar.tsx',
    'src/features/panels/ui/MainPanelFlowEditorManagerHeader.tsx',
    'src/features/panels/ui/SchemaSummary.tsx',
    'src/lib/panels/views/preview-panel/ui/MermaidDiagram.impl.tsx',
    'src/components/BottomPanel/hooks/useMarkdownSectionLogic.ts',
  ]

  for (const relativePath of files) {
    const text = readUtf8(relativePath)
    if (!text.includes('emitMainPanelOpen(')) {
      throw new Error(`expected ${relativePath} to use the shared main-panel emitter`)
    }
    if (text.includes('new CustomEvent(MAIN_PANEL_OPEN_EVENT') || text.includes('new CustomEventCtor(MAIN_PANEL_OPEN_EVENT')) {
      throw new Error(`expected ${relativePath} to avoid direct MAIN_PANEL_OPEN_EVENT dispatch boilerplate`)
    }
  }
}
