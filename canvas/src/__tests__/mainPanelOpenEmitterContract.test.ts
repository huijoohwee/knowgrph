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
    workflowManagerEntryLabel: 'Node',
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
  if (String(last.workflowManagerEntryLabel || '') !== 'Node') {
    throw new Error(`expected shared emitter to preserve workflowManagerEntryLabel detail, got ${JSON.stringify(last)}`)
  }

  dom.window.removeEventListener(MAIN_PANEL_OPEN_EVENT, listener as EventListener)
}

export const testMainPanelOpenCallsitesUseSharedEmitter = () => {
  const files = [
    'src/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceElements.tsx',
    'src/features/toolbar/GrabMapsDiscoveryWidgetSection.tsx',
    'src/features/canvas/CanvasQueryBootstrapRuntime.tsx',
    'src/features/panels/hooks/useHelpViewLogic.ts',
    'src/features/spotlight/LaunchSpotlightTourCard.tsx',
    'src/lib/markdown-core/ui/MarkdownMediaWrapper.tsx',
    'src/components/FlowEditor/NodeOverlayEditorActionsToolbar.tsx',
    'src/features/panels/ui/MainPanelFlowEditorManagerHeader.tsx',
    'src/features/panels/ui/SchemaSummary.tsx',
    'src/lib/panels/views/preview-panel/ui/MermaidDiagram.impl.tsx',
    'src/features/markdown-workspace/hooks/useMarkdownSectionLogic.ts',
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

export const testWorkflowManagerHeaderUsesSharedSectionChooser = () => {
  const text = readUtf8('src/features/panels/ui/MainPanelFlowEditorManagerHeader.tsx')
  if (!text.includes('<ToolbarDropdownSelect') || !text.includes('title={`Workflow section:') || text.includes('inline-flex items-center gap-1" aria-label={UI_LABELS.workflowManager}')) {
    throw new Error('expected workflow manager header section switching to use the shared click-expand-down chooser instead of a local horizontal row')
  }
}

export const testWorkflowManagerNodeEntryRequestFlowsFromToolbarIntoGraphFields = () => {
  const toolbarText = readUtf8('src/components/Toolbar.tsx')
  const useCanvasToolbarContextText = readUtf8('src/components/toolbar/useCanvasToolbarContext.ts')
  const mainPanelDragText = readUtf8('src/features/toolbar/hooks/useMainPanelDrag.ts')
  const mainPanelText = readUtf8('src/features/panels/MainPanel.tsx')
  const managerViewText = readUtf8('src/features/panels/views/FlowEditorManagerView.tsx')
  const graphTabText = readUtf8('src/features/flow-editor-manager/FlowEditorGraphTab.tsx')

  for (const snippet of [
    'workflowManagerEntryLabel?: string',
    'mainPanelRequestedWorkflowManagerEntryLabel',
    'workflowManagerEntryLabel: detailWorkflowManagerEntryLabel',
    'requestedWorkflowManagerEntryLabel={mainPanelRequestedWorkflowManagerEntryLabel}',
    'requestedEntryLabel={requestedWorkflowManagerEntryLabel}',
    'requestedEntryToken={requestedAnchorSeq}',
    'requestedEntryLabel?: string',
    'requestedEntryToken?: number',
    'const nextEntryLabel = String(requestedEntryLabel || \'\').trim()',
    'setEntryOpenRequest({',
  ]) {
    const source =
      toolbarText.includes(snippet) ? toolbarText
        : useCanvasToolbarContextText.includes(snippet) ? useCanvasToolbarContextText
        : mainPanelDragText.includes(snippet) ? mainPanelDragText
        : mainPanelText.includes(snippet) ? mainPanelText
        : managerViewText.includes(snippet) ? managerViewText
        : graphTabText
    if (!source.includes(snippet)) {
      throw new Error(`expected workflow manager node entry request snippet: ${snippet}`)
    }
  }
}
