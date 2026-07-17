import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  CHAT_INPUT_APPEND_EVENT,
  PROPS_PANEL_OPEN_EVENT,
  FLOATING_PANEL_OPEN_EVENT,
  WORKFLOW_RUN_ALL_EVENT,
  emitChatInputAppend,
  emitPropsPanelOpen,
  emitFloatingPanelOpen,
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
    listen(FLOATING_PANEL_OPEN_EVENT),
    listen(CHAT_INPUT_APPEND_EVENT),
    listen(WORKFLOW_RUN_ALL_EVENT),
  ]

  emitPropsPanelOpen({ clientX: 12, clientY: 34 })
  emitFloatingPanelOpen({ tab: 'view', open: true })
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
  expectEvent(FLOATING_PANEL_OPEN_EVENT, 'tab', 'view')
  expectEvent(CHAT_INPUT_APPEND_EVENT, 'text', 'hello')
  expectEvent(WORKFLOW_RUN_ALL_EVENT, 'source', 'toolbar')

  const fallbackSeen: Array<Record<string, unknown> | null> = []
  const fallbackHandler = (event: Event) => {
    fallbackSeen.push(((event as CustomEvent<Record<string, unknown>>).detail || null) as Record<string, unknown> | null)
  }
  const OriginalCustomEvent = dom.window.CustomEvent
  Object.defineProperty(dom.window, 'CustomEvent', {
    configurable: true,
    value: function BrokenCustomEvent() {
      throw new Error('CustomEvent constructor unavailable')
    },
  })
  dom.window.addEventListener(WORKFLOW_RUN_ALL_EVENT, fallbackHandler as EventListener)
  emitWorkflowRunAll({ source: 'toolbar' })
  dom.window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, fallbackHandler as EventListener)
  Object.defineProperty(dom.window, 'CustomEvent', { configurable: true, value: OriginalCustomEvent })
  if (fallbackSeen.length !== 1 || fallbackSeen[0]?.source !== 'toolbar') {
    throw new Error(`expected workflow Run All emitter to dispatch through document.createEvent fallback, got ${JSON.stringify(fallbackSeen)}`)
  }

  cleanup.forEach(fn => fn())
}

export const testCanvasActionEmittersUseSharedDispatcherBoundary = () => {
  const utilsText = readUtf8('src/features/canvas/utils.ts')
  const actionsToolbarText = readUtf8('src/components/StoryboardWidget/WidgetEditorActionsToolbar.tsx')
  const launcherText = readUtf8('src/features/toolbar/ToolbarMenuLauncher.tsx')
  const floatingBridgeText = readUtf8('src/features/toolbar/floatingPanelBridge.ts')
  const markdownDataViewBlockText = readUtf8('src/features/markdown/ui/MarkdownDataViewBlock.tsx')
  const floatingPanelChatOpenSeedText = readUtf8('src/features/chat/floatingPanelChat/floatingPanelChatOpenSeed.ts')
  const toolbarActionsText = readUtf8('src/features/toolbar/hooks/useToolbarActions.ts')
  const settingsViewConstantsText = readUtf8('src/features/panels/views/settingsView.constants.ts')

  if (!utilsText.includes('function emitCanvasCustomEvent')) {
    throw new Error('expected canvas utils to centralize repeated CustomEvent dispatch in a shared helper')
  }
  if (!utilsText.includes('new CustomEventCtor(eventName, { detail })')) {
    throw new Error('expected canvas utils shared dispatcher to own CustomEvent construction')
  }
  if (!utilsText.includes("fallbackDocument?.createEvent('CustomEvent')")) {
    throw new Error('expected canvas utils shared dispatcher to fall back when CustomEvent constructors are unavailable')
  }
  if (utilsText.includes('new CustomEvent<PropsPanelOpenEventDetail>(PROPS_PANEL_OPEN_EVENT')) {
    throw new Error('expected props panel emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<FloatingPanelOpenEventDetail>(FLOATING_PANEL_OPEN_EVENT')) {
    throw new Error('expected floating panel emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<ChatInputAppendEventDetail>(CHAT_INPUT_APPEND_EVENT')) {
    throw new Error('expected chat append emitter to stop owning raw CustomEvent construction')
  }
  if (utilsText.includes('new CustomEvent<WorkflowRunAllEventDetail>(WORKFLOW_RUN_ALL_EVENT')) {
    throw new Error('expected workflow run-all emitter to stop owning raw CustomEvent construction')
  }
  if (
    !actionsToolbarText.includes("import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'") ||
    !actionsToolbarText.includes('emitMainPanelOpen({') ||
    !actionsToolbarText.includes("workflowManagerTab: 'graph' as const")
  ) {
    throw new Error('expected widget actions toolbar to keep using the shared main-panel sidepane emitter')
  }
  if (!utilsText.includes('requestFloatingPanelOpen(detail)') || !utilsText.includes('requestPropsPanelOpen(detail)')) {
    throw new Error('expected canvas emitters to call the shared floating panel bridge before dispatching passive events')
  }
  if (!utilsText.includes("'media'") || !utilsText.includes("'animation'") || !launcherText.includes("tab === 'media'") || !launcherText.includes("tab === 'animation'")) {
    throw new Error('expected shared floating panel open events to support Media and Animation views')
  }
  if (!launcherText.includes('installFloatingPanelBridge({') || !launcherText.includes('openFloatingPanel')) {
    throw new Error('expected ToolbarMenuLauncher to register the shared floating panel bridge')
  }
  if (!floatingBridgeText.includes('requestFloatingPanelOpen') || !floatingBridgeText.includes('openFloatingPanel')) {
    throw new Error('expected floating panel bridge to centralize floating-panel open requests')
  }
  if (!markdownDataViewBlockText.includes('useWorkspaceDataViewFloatingRegistration') || !markdownDataViewBlockText.includes("emitFloatingPanelOpen({ tab: 'view', open: true })")) {
    throw new Error('expected MarkdownDataViewBlock viewer path to reuse the shared floating View registration and open emitter')
  }
  if (!floatingPanelChatOpenSeedText.includes('export function openFloatingPanelChat(): boolean')) {
    throw new Error('expected floatingPanelChatOpenSeed to own a shared open-only chat helper')
  }
  if (!floatingPanelChatOpenSeedText.includes("return emitFloatingPanelOpen({ tab: 'chat', open: true })")) {
    throw new Error('expected shared open-only chat helper to own the chat floating-panel emitter')
  }
  if (!toolbarActionsText.includes("import { openFloatingPanelChat } from '@/features/chat/floatingPanelChat/floatingPanelChatOpenSeed'") || !toolbarActionsText.includes('openFloatingPanelChat()')) {
    throw new Error('expected toolbar chat action to reuse the shared open-only chat helper')
  }
  if (toolbarActionsText.includes("emitFloatingPanelOpen({ tab: 'chat', open: true })")) {
    throw new Error('expected toolbar chat action to stop owning the raw chat floating-panel emitter')
  }
  if (!settingsViewConstantsText.includes("import { openFloatingPanelChat } from '@/features/chat/floatingPanelChat/floatingPanelChatOpenSeed'") || !settingsViewConstantsText.includes('openPanel: () => openFloatingPanelChat()')) {
    throw new Error('expected settings chat sections to reuse the shared open-only chat helper')
  }
  if (settingsViewConstantsText.includes("openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true })")) {
    throw new Error('expected settings chat sections to stop owning the raw chat floating-panel emitter')
  }
}
