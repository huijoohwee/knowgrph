import React from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingPanelChatMessagesSection } from '@/features/chat/FloatingPanelChatSections'
import {
  buildFloatingPanelChatSourceFilesSignature,
  buildFloatingPanelChatWorkspaceContextCacheKey,
  createFloatingPanelChatPipelineStages,
} from '@/features/chat/floatingPanelChat/floatingPanelChatSurfaceState'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

const createSource = (overrides: Record<string, unknown> = {}) => ({
  id: 'source-a',
  name: 'source-a.md',
  text: '# Source A',
  enabled: true,
  status: 'parsed' as const,
  parsedParserId: 'markdown',
  parsedTextHash: 'hash-a',
  ...overrides,
})

export function testFloatingPanelChatPipelineStagesDeriveFromRuntimeState() {
  const stages = createFloatingPanelChatPipelineStages({
    sourceFiles: [createSource(), createSource({ id: 'source-b', status: 'loading', parsedTextHash: '' })],
    graphData: { context: '', type: 'Graph', nodes: [{ id: 'node-a', label: 'A', type: 'Node', properties: {} }], edges: [] },
    workspaceViewMode: 'canvas',
  })
  const ingest = stages.find(stage => stage.id === 'ingest')
  const parse = stages.find(stage => stage.id === 'parse')
  const render = stages.find(stage => stage.id === 'render')
  if (ingest?.status !== 'active' || ingest.detail !== '2 sources') {
    throw new Error(`expected ingestion to reflect loading source state, got ${JSON.stringify(ingest)}`)
  }
  if (parse?.status !== 'active' || parse.detail !== '1/2 parsed') {
    throw new Error(`expected parse progress from source lifecycle, got ${JSON.stringify(parse)}`)
  }
  if (render?.status !== 'active') {
    throw new Error(`expected rendering to remain active while parsing is active, got ${JSON.stringify(render)}`)
  }
}

export function testFloatingPanelChatContextKeysRejectSameLengthMiddleEditStaleness() {
  const documentA = '# Title\nalpha payload\nfooter'
  const documentB = '# Title\nomega payload\nfooter'
  if (documentA.length !== documentB.length) throw new Error('test setup requires same-length documents')
  const keyA = buildFloatingPanelChatWorkspaceContextCacheKey({
    chatContextScope: 'workspace',
    markdownDocumentName: 'brief.md',
    markdownText: documentA,
    sourceFilesSignature: 'sources',
  })
  const keyB = buildFloatingPanelChatWorkspaceContextCacheKey({
    chatContextScope: 'workspace',
    markdownDocumentName: 'brief.md',
    markdownText: documentB,
    sourceFilesSignature: 'sources',
  })
  if (keyA === keyB) throw new Error('expected exact document hashing to reject stale same-length middle edits')

  const sourceSignatureA = buildFloatingPanelChatSourceFilesSignature([createSource({ text: documentA })])
  const sourceSignatureB = buildFloatingPanelChatSourceFilesSignature([createSource({ text: documentB })])
  if (sourceSignatureA === sourceSignatureB) throw new Error('expected source signature to include exact source text')
}

export async function testFloatingPanelChatPipelineStagesAreSemanticAndActionable() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const prompts: string[] = []
  const stages = createFloatingPanelChatPipelineStages({
    sourceFiles: [createSource()],
    graphData: { context: '', type: 'Graph', nodes: [{ id: 'node-a', label: 'A', type: 'Node', properties: {} }], edges: [] },
    workspaceViewMode: 'canvas',
  })

  try {
    await mountReactRoot(root, React.createElement(FloatingPanelChatMessagesSection, {
      messages: [],
      isLoading: false,
      historyKey: 'kg:pipeline-test',
      pipelineStages: stages,
      onPipelineStageAction: prompt => prompts.push(prompt),
      uiPanelTextFontClass: 'text-sm',
      uiPanelKeyValueTextSizeClass: 'text-xs',
      uiPanelMicroLabelTextSizeClass: 'text-xs',
      setMessages: () => undefined,
    }), { window: dom.window as unknown as Window, frames: 2 })

    const pipeline = container.querySelector('nav[data-kg-chat-pipeline="true"]')
    if (!pipeline || pipeline.getAttribute('aria-label') !== 'Document pipeline') {
      throw new Error('expected a semantic document pipeline navigation region')
    }
    const stageButtons = container.querySelectorAll('[data-kg-chat-pipeline-stage]')
    if (stageButtons.length !== 3) throw new Error(`expected three pipeline stages, got ${stageButtons.length}`)
    const parseButton = container.querySelector('[data-kg-chat-pipeline-stage="parse"]') as HTMLButtonElement | null
    if (!parseButton || parseButton.getAttribute('data-status') !== 'ready') {
      throw new Error('expected parsed source state to render as ready')
    }
    parseButton.click()
    await waitForFrames(dom.window as unknown as Window, 1)
    if (!prompts[0]?.includes('parser lifecycle')) {
      throw new Error(`expected pipeline stage action to publish its runtime-aware prompt, got ${JSON.stringify(prompts)}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
