import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

import { LiveCanvasHeroEditorial } from '@/components/LiveCanvasHero'
import {
  LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS,
  LIVE_CANVAS_HERO_TOKENS,
  appendLiveCanvasHeroToken,
  buildLiveCanvasHeroModel,
} from '@/features/agentic-os/liveCanvasHeroModel'
import { shouldShowLiveCanvasHero } from '@/features/canvas/liveCanvasHeroVisibility'
import { handoffLiveCanvasHeroQuery } from '@/features/canvas/liveCanvasHeroHandoff'
import {
  resolveLiveCanvasHeroSource,
  resolveLiveCanvasHeroWorkspaceSourceState,
} from '@/features/canvas/useKnowgrphLiveCanvasHero'
import {
  applyFloatingPanelChatInputHandoff,
  consumeFloatingPanelChatInputHandoff,
  flushFloatingPanelChatInputHandoff,
  queueFloatingPanelChatInputHandoff,
} from '@/features/chat/floatingPanelChat/floatingPanelChatInputHandoff'
import { CHAT_INPUT_APPEND_EVENT } from '@/features/canvas/utils'
import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { buildSourceFileParseIdentityHash } from '@/features/source-files/sourceFileParseIdentity'
import { WORKSPACE_README_SOURCE_PATH } from '@/features/source-files/workspaceSeedSourceFiles'
import type { SourceFile } from '@/hooks/store/types'
import type { GraphData } from '@/lib/graph/types'
import { isRouterRootAliasRuntime } from '@/lib/routing/basePath'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames } from '@/tests/lib/reactRootHarness'

const EXPECTED_TOKENS = [
  '/runtime-ready.check',
  '/cost.audit',
  '#token-economics',
  '#runtime-ready',
  '@runtime-proof',
  '@dev-only',
] as const
const EXPECTED_DEFAULT_QUERY = '/runtime-ready.check #token-economics @dev-only'

function readWorkspaceReadmeSource(): {
  text: string
  graphData: GraphData
  sourceFile: SourceFile
} {
  const path = resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'workspace-readme.md')
  const text = readFileSync(path, 'utf8')
  const parsed = tryParseMarkdownFrontmatterFlowGraph('workspace-readme.md', text)
  if (!parsed) throw new Error(`expected canonical workspace README to parse from ${path}`)
  const sourceFileId = 'workspace-readme-live-hero-proof'
  return {
    text,
    graphData: parsed.graphData,
    sourceFile: {
      id: sourceFileId,
      name: 'workspace-readme.md',
      text,
      enabled: true,
      status: 'parsed',
      parsedParserId: 'markdown',
      parsedTextHash: buildSourceFileParseIdentityHash({
        cacheNamespace: `source-file:${sourceFileId}`,
        name: 'workspace-readme.md',
        text,
      }),
      parsedGraphRevision: 1,
      parsedGraphData: parsed.graphData,
      source: { kind: 'local', path: WORKSPACE_README_SOURCE_PATH },
    } as SourceFile,
  }
}

export function testLiveCanvasHeroUsesSourceBackedInvocationContract(): void {
  if (JSON.stringify(LIVE_CANVAS_HERO_TOKENS) !== JSON.stringify(EXPECTED_TOKENS)) {
    throw new Error(`expected README-declared hero tokens, got ${JSON.stringify(LIVE_CANVAS_HERO_TOKENS)}`)
  }
  if (LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS.join(' ') !== EXPECTED_DEFAULT_QUERY) {
    throw new Error(`expected exact raw default query, got ${LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS.join(' ')}`)
  }
  const model = buildLiveCanvasHeroModel()
  if (model.status !== 'ready') {
    throw new Error(`expected all source-backed invocations to resolve, missing ${model.missingTokens.join(', ')}`)
  }
  if (model.defaultQuery !== EXPECTED_DEFAULT_QUERY || 'graphData' in model) {
    throw new Error('expected an editorial-only hero model with no synthetic graph')
  }
  for (const invocation of model.invocations) {
    const dictionary = invocation.token.startsWith('/')
      ? 'DICTIONARY-COMMAND.md'
      : invocation.token.startsWith('#')
        ? 'DICTIONARY-SEMANTIC.md'
        : 'DICTIONARY-BINDING.md'
    if (!invocation.sourcePath.endsWith(dictionary) || invocation.sourcePath.includes('/Users/')) {
      throw new Error(`expected portable dictionary source for ${invocation.token}, got ${invocation.sourcePath}`)
    }
  }

  const { text } = readWorkspaceReadmeSource()
  for (const token of EXPECTED_TOKENS) {
    if (!text.includes(token)) throw new Error(`expected ${token} to be declared by workspace-readme.md`)
  }
}

export function testLiveCanvasHeroWorkspaceReadmeSourceFidelity(): void {
  const { text, graphData, sourceFile } = readWorkspaceReadmeSource()
  const source = resolveLiveCanvasHeroSource({ sourceFiles: [sourceFile], activeGraphData: graphData })
  if (!source) throw new Error('expected the current parsed workspace README to own the live hero source')
  if (
    source.sourcePath !== WORKSPACE_README_SOURCE_PATH
    || source.graphId !== 'md:workspace-readme'
    || source.schema !== 'kgc-workspace-readme/v1'
    || source.sourceLayerHash !== String(graphData.metadata?.sourceLayerHash || '')
  ) {
    throw new Error(`expected exact workspace README provenance, got ${JSON.stringify({
      path: source.sourcePath,
      graphId: source.graphId,
      schema: source.schema,
    })}`)
  }
  if (graphData.nodes.length !== 17 || graphData.edges.length !== 7) {
    throw new Error(`expected the current live README graph, got ${graphData.nodes.length} nodes/${graphData.edges.length} edges`)
  }
  if (source.canvasGraphData.nodes.length !== 3 || source.canvasGraphData.edges.length !== 2) {
    throw new Error(`expected the source-derived command route, got ${source.canvasGraphData.nodes.length} nodes/${source.canvasGraphData.edges.length} edges`)
  }
  const nodeIds = new Set(graphData.nodes.map(node => String(node.id)))
  for (const id of ['workspace-source', 'workspace-runtime', 'workspace-publish']) {
    if (!nodeIds.has(id)) throw new Error(`expected authored workspace node ${id}`)
  }
  const edgeSignatures = new Set(graphData.edges.map(edge => `${edge.source}->${edge.target}`))
  for (const signature of ['workspace-source->workspace-runtime', 'workspace-runtime->workspace-publish']) {
    if (!edgeSignatures.has(signature)) throw new Error(`expected authored workspace edge ${signature}`)
  }

  const staleFile = { ...sourceFile, text: text.replace('value: "workspace-source"', 'value: "workspace-source-edited"') }
  if (resolveLiveCanvasHeroSource({ sourceFiles: [staleFile], activeGraphData: graphData })) {
    throw new Error('expected edited text with a stale parse identity to fail closed')
  }
  const wrongPathFile = { ...sourceFile, source: { kind: 'local', path: 'workspace:/product.md' } } as SourceFile
  if (resolveLiveCanvasHeroSource({ sourceFiles: [wrongPathFile], activeGraphData: graphData })) {
    throw new Error('expected a non-canonical source path to fail closed')
  }
  const mismatchedActiveGraph = {
    ...graphData,
    nodes: graphData.nodes.filter(node => node.id !== 'workspace-source'),
  }
  if (resolveLiveCanvasHeroSource({ sourceFiles: [sourceFile], activeGraphData: mismatchedActiveGraph })) {
    throw new Error('expected a stale active graph to fail closed')
  }
}

export function testLiveCanvasHeroVisibilityFailsClosedOutsideHydratedApex(): void {
  if (!isRouterRootAliasRuntime('/knowgrph/', { pathname: '/', rootAliasBasePath: '/knowgrph/' })) {
    throw new Error('expected the injected apex alias marker to resolve as root alias runtime')
  }
  if (isRouterRootAliasRuntime('/knowgrph/', { pathname: '/knowgrph/', rootAliasBasePath: '/knowgrph/' })) {
    throw new Error('expected the canonical /knowgrph route to stay outside the apex hero runtime')
  }

  const { sourceFile } = readWorkspaceReadmeSource()
  const defaultSeedState = resolveLiveCanvasHeroWorkspaceSourceState({
    sourceFiles: [sourceFile],
    markdownDocumentName: 'workspace-readme.md',
  })
  if (!defaultSeedState.defaultSeedOnly || defaultSeedState.meaningfulSourceFilesPresent) {
    throw new Error(`expected the default seed to remain hero-eligible, got ${JSON.stringify(defaultSeedState)}`)
  }
  const customSourceState = resolveLiveCanvasHeroWorkspaceSourceState({
    sourceFiles: [{ ...sourceFile, source: { kind: 'local', path: 'workspace:/product.md' } } as SourceFile],
    markdownDocumentName: 'product.md',
  })
  if (!customSourceState.meaningfulSourceFilesPresent || customSourceState.defaultSeedOnly) {
    throw new Error(`expected authored sources to suppress the hero, got ${JSON.stringify(customSourceState)}`)
  }
  const starterInitializationState = resolveLiveCanvasHeroWorkspaceSourceState({
    sourceFiles: [sourceFile, {
      ...sourceFile,
      id: 'starter-template',
      name: 'knowgrph-strybldr-starter-template.md',
      source: { kind: 'local', path: 'workspace:/docs/knowgrph-strybldr-starter-template.md' },
    }],
    markdownDocumentName: 'knowgrph-strybldr-starter-template.md',
  })
  if (starterInitializationState.meaningfulSourceFilesPresent || !starterInitializationState.defaultSeedOnly) {
    throw new Error(`expected the canonical starter document to remain part of landing initialization, got ${JSON.stringify(starterInitializationState)}`)
  }

  const emptyGraph: GraphData = { type: 'Graph', nodes: [], edges: [] }
  const base = {
    isRootAlias: true,
    sourceFilesBootstrapReady: true,
    liveWorkspaceSourceReady: true,
    dismissed: false,
    hasSearchParams: false,
    isEmbeddedPreview: false,
    workspaceEditorOverlayOpen: false,
    workspaceDocumentSwitchPending: false,
    floatingPanelOpen: false,
    alternateCanvasSurfaceActive: false,
    defaultSeedOnly: true,
    meaningfulSourceFilesPresent: false,
    graphData: emptyGraph,
    markdownDocumentText: '',
  }
  if (!shouldShowLiveCanvasHero(base)) throw new Error('expected a source-ready apex workspace to show the hero')
  const suppressions = [
    { isRootAlias: false },
    { sourceFilesBootstrapReady: false },
    { liveWorkspaceSourceReady: false },
    { dismissed: true },
    { hasSearchParams: true },
    { isEmbeddedPreview: true },
    { workspaceEditorOverlayOpen: true },
    { workspaceDocumentSwitchPending: true },
    { floatingPanelOpen: true },
    { alternateCanvasSurfaceActive: true },
    { meaningfulSourceFilesPresent: true },
  ]
  for (const suppression of suppressions) {
    if (shouldShowLiveCanvasHero({ ...base, ...suppression })) {
      throw new Error(`expected hero suppression for ${JSON.stringify(suppression)}`)
    }
  }
}

export function testLiveCanvasHeroUsesInteractiveWorkspaceCanvas(): void {
  const viewportSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx'), 'utf8')
  const heroSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'LiveCanvasHero.tsx'), 'utf8')
  const modelSource = readFileSync(resolve(process.cwd(), 'src', 'features', 'agentic-os', 'liveCanvasHeroModel.ts'), 'utf8')
  const flowCanvasSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx'), 'utf8')
  const flowGraphStateSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts'), 'utf8')
  const flowZoomSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'applyZoomRequestNative.ts'), 'utf8')
  for (const contract of [
    'data-kg-live-canvas-hero-canvas="workspace-runtime"',
    'data-kg-live-canvas-hero-interactive="true"',
    'graphDataOverride={liveCanvasHeroSource.canvasGraphData}',
    'mutationSourceGraphDataOverride={liveCanvasHeroSource.graphData}',
    'canvas2dRendererOverride="flow"',
    'suppressMediaOverlays',
    'flowWidgetStateGraphKeyOverride={`live-hero:${liveCanvasHeroSource.sourceLayerHash}`}',
    '<LiveCanvasHeroLazy source={liveCanvasHeroSource}',
  ]) {
    if (!viewportSource.includes(contract)) throw new Error(`expected interactive workspace canvas contract ${contract}`)
  }
  if (!viewportSource.includes('<FlowCanvasLazy') || !viewportSource.includes('forbidCircleNodes')) {
    throw new Error('expected the source-derived graph to retain live FlowCanvas pan, zoom, selection, and drag ownership')
  }
  if (!viewportSource.includes("alternateCanvasSurfaceActive: geospatialModeEnabled || canvasRenderMode !== '2d'")
    || viewportSource.includes("alternateCanvasSurfaceActive: geospatialModeEnabled || canvasRenderMode !== '2d' || active2dSurface !== 'storyboard'")) {
    throw new Error('expected the root hero to override any current 2D renderer while preserving alternate 3D and geospatial ownership')
  }
  if (!flowCanvasSource.includes('canvas2dRendererOverride || storeCanvas2dRenderer')
    || !flowZoomSource.includes('args.canvas2dRendererOverride ?? state.canvas2dRenderer')) {
    throw new Error('expected the embedded source route to own flow rendering and fit behavior without mutating the workspace renderer setting')
  }
  if (!flowCanvasSource.includes('data-kg-canvas-scene-node-count') || !flowCanvasSource.includes('data-kg-canvas-scene-edge-count')) {
    throw new Error('expected queryable live scene counts for agent-ready runtime proof')
  }
  if (!flowCanvasSource.includes('suppressMediaOverlays,')
    || !flowGraphStateSource.includes('if (suppressMediaOverlays)')
    || !flowGraphStateSource.includes('stickyOverlayNodeByIdRef.current.clear()')
    || viewportSource.includes('excludeRichMediaOverlayNodeIds=')) {
    throw new Error('expected suppressed overlays to stay in the interactive native node and edge scene')
  }
  for (const stale of ['FlowCanvasLazy', 'presentationOnly', 'graphDataOverride={model.graphData}', 'nodeLayoutByToken']) {
    if (`${heroSource}\n${modelSource}`.includes(stale)) throw new Error(`expected synthetic hero renderer code to be removed: ${stale}`)
  }
  if (!heroSource.includes('pointer-events-none absolute inset-0') || !heroSource.includes('pointer-events-auto absolute')) {
    throw new Error('expected the editorial shell to pass pointer input through except for its command deck')
  }
  if (!heroSource.includes("requestZoom('fit', { intent: 'fitToView' })")) {
    throw new Error('expected the live source route to fit once on hero mount and remain user-interactive afterward')
  }
  for (const forbidden of ['reactflow', '#ff0071', 'cube', 'pyramid', '<img', '?raw']) {
    if (`${heroSource}\n${modelSource}`.toLowerCase().includes(forbidden)) {
      throw new Error(`expected no copied or static reference asset token ${forbidden}`)
    }
  }
}

export async function testLiveCanvasHeroChatHandoffPreservesRawGrammar(): Promise<void> {
  consumeFloatingPanelChatInputHandoff()
  queueFloatingPanelChatInputHandoff({ text: EXPECTED_DEFAULT_QUERY, mode: 'replace' })
  const handoff = consumeFloatingPanelChatInputHandoff()
  if (handoff?.text !== EXPECTED_DEFAULT_QUERY || handoff.mode !== 'replace') {
    throw new Error(`expected exact raw grammar handoff, got ${JSON.stringify(handoff)}`)
  }
  if (consumeFloatingPanelChatInputHandoff() !== null) throw new Error('expected the pending Chat draft to be consumed once')
  const appended = applyFloatingPanelChatInputHandoff('Keep this context', { text: EXPECTED_DEFAULT_QUERY, mode: 'append' })
  if (appended !== `Keep this context\n\n${EXPECTED_DEFAULT_QUERY}`) {
    throw new Error(`expected append handoff to preserve editable text, got ${JSON.stringify(appended)}`)
  }
  if (appendLiveCanvasHeroToken(EXPECTED_DEFAULT_QUERY, '@dev-only') !== EXPECTED_DEFAULT_QUERY) {
    throw new Error('expected quick tokens to remain idempotent')
  }

  const { restore } = initJsdomHarness()
  try {
    let errorText = ''
    try {
      await handoffLiveCanvasHeroQuery(EXPECTED_DEFAULT_QUERY)
    } catch (error) {
      errorText = error instanceof Error ? error.message : String(error)
    }
    if (!errorText.includes('Chat is not ready')) {
      throw new Error(`expected unacknowledged Chat open to fail visibly, got ${JSON.stringify(errorText)}`)
    }
    if (consumeFloatingPanelChatInputHandoff() !== null) throw new Error('expected failed Chat open to clear its pending draft')
  } finally {
    restore()
  }
}

export async function testLiveCanvasHeroChatHandoffFlushesThroughSharedAppendEvent(): Promise<void> {
  const { dom, restore } = initJsdomHarness()
  const details: Array<{ text?: string; mode?: string }> = []
  const listener = (event: Event) => {
    details.push(((event as CustomEvent<{ text?: string; mode?: string }>).detail) || {})
  }
  try {
    consumeFloatingPanelChatInputHandoff()
    dom.window.addEventListener(CHAT_INPUT_APPEND_EVENT, listener as EventListener)
    queueFloatingPanelChatInputHandoff({ text: `  ${EXPECTED_DEFAULT_QUERY}   `, mode: 'replace' })
    if (!flushFloatingPanelChatInputHandoff()) throw new Error('expected queued hero handoff to flush')
    if (details.length !== 1 || details[0]?.text !== EXPECTED_DEFAULT_QUERY || details[0]?.mode !== 'replace') {
      throw new Error(`expected one normalized shared append event, got ${JSON.stringify(details)}`)
    }
  } finally {
    dom.window.removeEventListener(CHAT_INPUT_APPEND_EVENT, listener as EventListener)
    restore()
  }
}

export async function testLiveCanvasHeroInteractionHandsOffOnlyOnRun(): Promise<void> {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  const handedOffQueries: string[] = []
  let completedCount = 0
  const model = buildLiveCanvasHeroModel()
  if (model.status !== 'ready') throw new Error(`expected ready hero model, missing ${model.missingTokens.join(', ')}`)

  try {
    await mountReactRoot(root, (
      <LiveCanvasHeroEditorial
        model={model}
        handoff={query => { handedOffQueries.push(query) }}
        onHandoffComplete={() => { completedCount += 1 }}
      />
    ), { window: dom.window as unknown as Window, frames: 2 })

    const textarea = container.querySelector('[data-kg-live-canvas-hero-query="true"]') as HTMLTextAreaElement | null
    if (!textarea || textarea.value !== EXPECTED_DEFAULT_QUERY) {
      throw new Error(`expected visible raw editable hero query, got ${JSON.stringify(textarea?.value)}`)
    }
    if (handedOffQueries.length !== 0 || completedCount !== 0) throw new Error('expected zero handoff on mount')
    const proofToken = container.querySelector('[data-kg-agentic-os-invocation-token="@runtime-proof"]') as HTMLButtonElement | null
    if (!proofToken) throw new Error('expected source-backed @runtime-proof quick token')
    await act(async () => {
      proofToken.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (String(textarea.value) !== `${EXPECTED_DEFAULT_QUERY} @runtime-proof`) {
      throw new Error(`expected raw token append, got ${JSON.stringify(textarea.value)}`)
    }
    const startButton = container.querySelector('[data-kg-live-canvas-hero-start="true"]') as HTMLButtonElement | null
    if (!startButton) throw new Error('expected explicit Start locally action')
    await act(async () => {
      startButton.click()
      await waitForFrames(dom.window as unknown as Window, 1)
    })
    if (Number(handedOffQueries.length) !== 1 || handedOffQueries[0] !== textarea.value || Number(completedCount) !== 1) {
      throw new Error(`expected exactly one explicit handoff, got ${JSON.stringify({ handedOffQueries, completedCount })}`)
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}
