import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  CHAT_INPUT_APPEND_EVENT,
  PROPS_PANEL_OPEN_EVENT,
  SIDE_PANEL_OPEN_EVENT,
  WORKFLOW_RUN_ALL_EVENT,
  emitChatInputAppend,
  emitPropsPanelOpen,
  emitSidePanelOpen,
  emitWorkflowRunAll,
} from '@/features/canvas/utils'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testCanvasActionEmittersReuseSharedCustomEventDispatcher = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const seen: Array<{ type: string; detail: Record<string, unknown> | null }> = []
  const listen = (type: string) => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Record<string, unknown>>
      seen.push({ type, detail: (custom.detail || null) as Record<string, unknown> | null })
    }
    dom.window.addEventListener(type, handler as EventListener)
    return () => dom.window.removeEventListener(type, handler as EventListener)
  }

  const cleanup = [
    listen(PROPS_PANEL_OPEN_EVENT),
    listen(SIDE_PANEL_OPEN_EVENT),
    listen(CHAT_INPUT_APPEND_EVENT),
    listen(WORKFLOW_RUN_ALL_EVENT),
  ]

  emitPropsPanelOpen({ clientX: 12, clientY: 34 })
  emitSidePanelOpen({ tab: 'view', open: true })
  emitChatInputAppend({ text: 'hello', mode: 'append' })
  emitWorkflowRunAll({ source: 'toolbar' })
  await new Promise<void>(resolve => setTimeout(resolve, 0))

  const expectEvent = (type: string, key: string, value: unknown) => {
    const match = seen.find(entry => entry.type === type)
    if (!match) throw new Error(`expected ${type} to dispatch`)
    if (String(match.detail?.[key] ?? '') !== String(value ?? '')) {
      throw new Error(`expected ${type} to preserve ${key}, got ${JSON.stringify(match.detail)}`)
    }
  }

  expectEvent(PROPS_PANEL_OPEN_EVENT, 'clientX', 12)
  expectEvent(SIDE_PANEL_OPEN_EVENT, 'tab', 'view')
  expectEvent(CHAT_INPUT_APPEND_EVENT, 'text', 'hello')
  expectEvent(WORKFLOW_RUN_ALL_EVENT, 'source', 'toolbar')

  cleanup.forEach(fn => fn())
}

export const testCanvasActionEmittersUseSharedDispatcherBoundary = () => {
  const utilsText = readUtf8('src/features/canvas/utils.ts')
  const floatingPropsText = readUtf8('src/lib/toolbar/useFloatingPropsPanelModel.impl.ts')
  const actionsToolbarText = readUtf8('src/components/FlowEditor/NodeOverlayEditorActionsToolbar.tsx')
  const launcherText = readUtf8('src/features/toolbar/ToolbarMenuLauncher.tsx')
  const floatingBridgeText = readUtf8('src/features/toolbar/floatingPanelBridge.ts')
  const markdownDataViewBlockText = readUtf8('src/features/markdown/ui/MarkdownDataViewBlock.tsx')

  if (!utilsText.includes('function emitCanvasCustomEvent')) {
    throw new Error('expected canvas utils to centralize repeated CustomEvent dispatch in a shared helper')
  }
  if (!utilsText.includes('new CustomEventCtor(eventName, { detail })')) {
    throw new Error('expected canvas utils shared dispatcher to own CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<PropsPanelOpenEventDetail>(PROPS_PANEL_OPEN_EVENT')) {
    throw new Error('expected props panel emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<SidePanelOpenEventDetail>(SIDE_PANEL_OPEN_EVENT')) {
    throw new Error('expected side panel emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<ChatInputAppendEventDetail>(CHAT_INPUT_APPEND_EVENT')) {
    throw new Error('expected chat append emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<WorkflowRunAllEventDetail>(WORKFLOW_RUN_ALL_EVENT')) {
    throw new Error('expected workflow run-all emitter to stop owning raw CustomEvent construction')
  }
  if (!floatingPropsText.includes('emitSidePanelOpen(') || !floatingPropsText.includes('emitChatInputAppend(')) {
    throw new Error('expected floating props panel model to keep using shared canvas action emitters')
  }
  if (!actionsToolbarText.includes('emitSidePanelOpen({ tab: \'node\', open: true })')) {
    throw new Error('expected node overlay actions toolbar to keep using the shared side panel emitter')
  }
  if (!utilsText.includes('requestSidePanelOpen(detail)') || !utilsText.includes('requestPropsPanelOpen(detail)')) {
    throw new Error('expected canvas emitters to call the shared floating panel bridge before dispatching passive events')
  }
  if (!launcherText.includes('installFloatingPanelBridge({') || !launcherText.includes('openSidePanel')) {
    throw new Error('expected ToolbarMenuLauncher to register the shared floating panel bridge')
  }
  if (!floatingBridgeText.includes('requestSidePanelOpen') || !floatingBridgeText.includes('openSidePanel')) {
    throw new Error('expected floating panel bridge to centralize side-panel open requests')
  }
  if (!markdownDataViewBlockText.includes('useWorkspaceDataViewFloatingRegistration') || !markdownDataViewBlockText.includes("emitSidePanelOpen({ tab: 'view', open: true })")) {
    throw new Error('expected MarkdownDataViewBlock viewer path to reuse the shared floating View registration and open emitter')
  }
}
