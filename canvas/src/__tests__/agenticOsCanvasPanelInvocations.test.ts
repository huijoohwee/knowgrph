import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AGENTIC_OS_CANVAS_INTERACTION_PANEL_KEYWORD,
  AGENTIC_OS_BINDING_INVOCATIONS,
  AGENTIC_OS_COMMAND_INVOCATIONS,
  AGENTIC_OS_SEMANTIC_INVOCATIONS,
  findAgenticOsInvocationByToken,
  getAgenticOsCanvasInteractionPanelInvocations,
} from '@/features/agentic-os/agenticOsDocInvocations'
import { parseChatInvocationDirectives } from '@/features/chat/chatInvocationRegistry'
import { resolveChatRuntimeInvocationQuery } from '@/features/chat/chatRuntimeInvocationQuery'

const CANVAS_FUNCTION_INVOCATIONS = [
  {
    capability: 'add',
    slash: ['/canvas.node.add', '/canvas.node.link'],
    hash: ['#canvas-node', '#canvas-selection'],
    at: ['@canvas-center', '@selected-node', '@edge-endpoint'],
  },
  {
    capability: 'node',
    slash: ['/canvas.selection.open', '/canvas.selection.chat', '/canvas.selection.delete', '/canvas.node.link'],
    hash: ['#canvas-node', '#canvas-selection'],
    at: ['@selected-node', '@markdown-provenance'],
  },
  {
    capability: 'media',
    slash: ['/canvas.media.attach'],
    hash: ['#canvas-media'],
    at: ['@selected-node', '@media-url'],
  },
  {
    capability: 'layout',
    slash: ['/canvas.layout.tune', '/canvas.physics.tune'],
    hash: ['#canvas-layout', '#canvas-physics'],
    at: ['@layout-forces', '@physics-2d'],
  },
  {
    capability: 'viewport',
    slash: ['/canvas.viewport.inspect', '/canvas.viewport.transform'],
    hash: ['#canvas-viewport', '#canvas-transform', '#canvas-zoom', '#canvas-wheel'],
    at: ['@viewport-readout', '@viewport-transform', '@zoom-mode', '@wheel-input', '@interaction-speed'],
  },
  {
    capability: 'interaction',
    slash: ['/canvas.interaction.tune'],
    hash: ['#canvas-interaction', '#canvas-flow'],
    at: ['@flow-run-mode', '@drag-alpha-target', '@interaction-speed'],
  },
  {
    capability: 'centering',
    slash: ['/canvas.center', '/canvas.distribute'],
    hash: ['#canvas-centroid', '#canvas-even-spread', '#canvas-selection'],
    at: ['@centroid-target', '@spread-axis', '@selected-node'],
  },
  {
    capability: 'performance',
    slash: ['/canvas.performance.audit'],
    hash: ['#canvas-performance', '#canvas-viewport'],
    at: ['@performance-overlay', '@runtime-proof'],
  },
  {
    capability: 'edge',
    slash: ['/canvas.edge.rewire', '/canvas.node.link', '/canvas.selection.open', '/canvas.selection.chat'],
    hash: ['#canvas-edge', '#canvas-selection'],
    at: ['@selected-edge', '@edge-endpoint', '@markdown-provenance'],
  },
] as const

const collectExpectedTokens = (prefix: '/' | '#' | '@'): readonly string[] => (
  Array.from(new Set(CANVAS_FUNCTION_INVOCATIONS.flatMap(invocation => (
    prefix === '/'
      ? invocation.slash
      : prefix === '#'
        ? invocation.hash
        : invocation.at
  ))))
)

const assertRegistryHasTokens = (
  registry: readonly { token: string; sourcePath: string; dictionaryFileName: string }[],
  expectedTokens: readonly string[],
  dictionaryFileName: string,
) => {
  for (const token of expectedTokens) {
    const invocation = registry.find(entry => entry.token === token)
    if (!invocation) throw new Error(`Expected ${token} to be registered in the Agentic OS ${dictionaryFileName} runtime mirror`)
    if (invocation.dictionaryFileName !== dictionaryFileName || !invocation.sourcePath.endsWith(dictionaryFileName)) {
      throw new Error(`Expected ${token} to resolve to ${dictionaryFileName}, got ${JSON.stringify(invocation)}`)
    }
    const resolved = findAgenticOsInvocationByToken(token)
    if (!resolved || resolved.kind === 'doc' || resolved.sourcePath !== invocation.sourcePath) {
      throw new Error(`Expected ${token} to resolve through the shared Agentic OS dictionary lookup, got ${JSON.stringify(resolved)}`)
    }
  }
}

const assertSourceDictionaryHasTokens = (
  dictionaryFileName: string,
  expectedTokens: readonly string[],
) => {
  const sourcePath = resolve(process.cwd(), '..', '..', 'agentic-canvas-os', 'docs', dictionaryFileName)
  const source = readFileSync(sourcePath, 'utf8')
  for (const token of expectedTokens) {
    if (!source.includes(`  - "${token}"`)) {
      throw new Error(`Expected ${dictionaryFileName} frontmatter dictionary_entries to include ${token}`)
    }
    if (!source.includes(`| \`${token}\` |`)) {
      throw new Error(`Expected ${dictionaryFileName} body table to define ${token}`)
    }
  }
}

export function testCanvasPanelFunctionsAreAgenticOsInvokable() {
  const slashTokens = collectExpectedTokens('/')
  const hashTokens = collectExpectedTokens('#')
  const atTokens = collectExpectedTokens('@')

  assertRegistryHasTokens(AGENTIC_OS_COMMAND_INVOCATIONS, slashTokens, 'DICTIONARY-COMMAND.md')
  assertRegistryHasTokens(AGENTIC_OS_SEMANTIC_INVOCATIONS, hashTokens, 'DICTIONARY-SEMANTIC.md')
  assertRegistryHasTokens(AGENTIC_OS_BINDING_INVOCATIONS, atTokens, 'DICTIONARY-BINDING.md')

  assertSourceDictionaryHasTokens('DICTIONARY-COMMAND.md', slashTokens)
  assertSourceDictionaryHasTokens('DICTIONARY-SEMANTIC.md', hashTokens)
  assertSourceDictionaryHasTokens('DICTIONARY-BINDING.md', atTokens)

  for (const invocation of CANVAS_FUNCTION_INVOCATIONS) {
    for (const token of [...invocation.slash, ...invocation.hash, ...invocation.at]) {
      const runtimeQuery = resolveChatRuntimeInvocationQuery(`${token} ${invocation.capability} from active canvas context`)
      if (runtimeQuery.leadingRoute?.kind !== 'agentic-os' || runtimeQuery.leadingRoute.token !== token) {
        throw new Error(`Expected ${token} to be invokable as an Agentic OS runtime route, got ${JSON.stringify(runtimeQuery)}`)
      }
    }
    const directives = parseChatInvocationDirectives(invocation.hash.join(' '))
    const directiveTokens = new Set(directives.map(directive => directive.token))
    for (const hashToken of invocation.hash) {
      if (!directiveTokens.has(hashToken)) {
        throw new Error(`Expected ${hashToken} to parse as a chat semantic directive for ${invocation.capability}`)
      }
    }
  }

  const skillsCommandsView = readFileSync(resolve(process.cwd(), 'src/features/panels/views/SkillsCommandsView.tsx'), 'utf8')
  const composer = readFileSync(resolve(process.cwd(), 'src/features/chat/floatingPanelChat/FloatingPanelChatComposer.tsx'), 'utf8')
  for (const registryName of ['AGENTIC_OS_COMMAND_INVOCATIONS', 'AGENTIC_OS_SEMANTIC_INVOCATIONS', 'AGENTIC_OS_BINDING_INVOCATIONS']) {
    if (!composer.includes(registryName)) {
      throw new Error(`Expected FloatingPanel Chat composer to consume ${registryName}`)
    }
  }
  if (!skillsCommandsView.includes('CHAT_INVOCATION_OPTIONS') || !skillsCommandsView.includes('AGENTIC_OS_COMMAND_INVOCATIONS') || !skillsCommandsView.includes('AGENTIC_OS_BINDING_INVOCATIONS')) {
    throw new Error('Expected Skills & Commands to consume shared /, #, and @ invocation registries')
  }

  const floatingPropsPanel = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPropsPanel.tsx'), 'utf8')
  for (const staleSnippet of ['useFloatingPropsPanelModel', 'PanelRangeInput', 'Add Media Node', 'Strong spread preset']) {
    if (floatingPropsPanel.includes(staleSnippet)) {
      throw new Error(`Expected canvas function invocations to stay in shared dictionaries instead of reintroducing local panel controls: ${staleSnippet}`)
    }
  }
}

export function testCanvasInteractionInvocationsUseSkillsCommandsCatalog() {
  const invocations = getAgenticOsCanvasInteractionPanelInvocations()
  const tokenSet = new Set<string>(invocations.map(invocation => invocation.token))
  const expectedTokens = new Set([
    '/canvas.layout.tune',
    '/canvas.viewport.inspect',
    '/canvas.viewport.transform',
    '/canvas.interaction.tune',
    '/canvas.physics.tune',
    '/canvas.center',
    '/canvas.distribute',
    '/canvas.performance.audit',
    '#canvas-viewport',
    '#canvas-transform',
    '#canvas-zoom',
    '#canvas-wheel',
    '#canvas-interaction',
    '#canvas-flow',
    '#canvas-physics',
    '#canvas-centroid',
    '#canvas-even-spread',
    '#canvas-performance',
    '@viewport-readout',
    '@viewport-transform',
    '@zoom-mode',
    '@wheel-input',
    '@interaction-speed',
    '@flow-run-mode',
    '@drag-alpha-target',
    '@physics-2d',
    '@centroid-target',
    '@spread-axis',
    '@performance-overlay',
  ])

  for (const token of expectedTokens) {
    if (!tokenSet.has(token)) {
      throw new Error(`Expected canvas interaction panel invocation metadata to include ${token}`)
    }
  }
  for (const kind of ['command', 'semantic', 'binding'] as const) {
    if (!invocations.some(invocation => invocation.kind === kind)) {
      throw new Error(`Expected canvas interaction panel invocation metadata to include ${kind} entries`)
    }
  }
  for (const invocation of invocations) {
    if (!invocation.keywords.includes(AGENTIC_OS_CANVAS_INTERACTION_PANEL_KEYWORD)) {
      throw new Error(`Expected ${invocation.token} to be selected by the shared panel keyword`)
    }
  }

  const toolbar = readFileSync(resolve(process.cwd(), 'src/lib/toolbar/ToolbarToolMenu.impl.tsx'), 'utf8')
  const floatingSkillsCommands = readFileSync(resolve(process.cwd(), 'src/features/toolbar/FloatingPanelSkillsCommandsView.tsx'), 'utf8')
  const catalogSearchLayout = readFileSync(resolve(process.cwd(), 'src/lib/ui/floatingPanelCatalogLayout.tsx'), 'utf8')
  if (
    !floatingSkillsCommands.includes("import SkillsCommandsView from '@/features/panels/views/SkillsCommandsView'") ||
    !floatingSkillsCommands.includes('<SkillsCommandsView prefixFilter={prefixFilter} searchQuery={search.searchQuery} />') ||
    !catalogSearchLayout.includes('export function useFloatingPanelCatalogSearch(): FloatingPanelCatalogSearchState') ||
    !toolbar.includes("<FloatingPanelSkillsCommandsView />")
  ) {
    throw new Error('Expected canvas interaction invocations to resolve through the central Skills & Commands catalog')
  }
  for (const staleSnippet of [
    'InfiniteCanvasInteractionPanel',
    "view: 'interaction'",
    "floatingPanelView === 'interaction'",
    'handleOpenInteractionSkillsCommands',
    'CANVAS_INTERACTION_SKILLS_COMMANDS_QUERY',
  ]) {
    if (toolbar.includes(staleSnippet) || floatingSkillsCommands.includes(staleSnippet) || catalogSearchLayout.includes(staleSnippet)) {
      throw new Error(`Expected stale Interaction floating view handoff code to be removed: ${staleSnippet}`)
    }
  }
  for (const staleSnippet of [
    'InfiniteCanvasInteractionPanel',
    'renderAgenticOsInvocationKeywordChip',
    'data-kg-canvas-interaction-invocation-panel',
    'PanelLabeledRangeCard',
    'TwoColumnEditorGrid',
    'CanvasPerformancePanel',
    'Viewport size',
    'Zoom percent',
    'Velocity decay bias',
    'Drag alphaTarget',
    'Physics 2D',
    'Centering / Centroid',
    'Even Spread',
    'Distribute Horizontally',
    'Show Perf Overlay',
  ]) {
    if (toolbar.includes(staleSnippet) || floatingSkillsCommands.includes(staleSnippet)) {
      throw new Error(`Expected Skills & Commands centralization to avoid stale Interaction panel code: ${staleSnippet}`)
    }
  }
}
