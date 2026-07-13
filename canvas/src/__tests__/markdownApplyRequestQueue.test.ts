import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'

export async function testQueuedMarkdownApplyAwaitsExactActiveDocumentCommit() {
  const state = useGraphStore.getState()
  state.resetAll()
  const firstApply = state.setActiveMarkdownDocument({
    name: 'docs/first.md',
    text: '# First document\n\nAlpha',
    applyViewPreset: false,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  const secondApply = useGraphStore.getState().setActiveMarkdownDocument({
    name: 'docs/video-preset.md',
    text: '# Video preset document\n\nBeta',
    applyViewPreset: false,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  const [firstApplied, secondApplied] = await Promise.all([firstApply, secondApply])
  const after = useGraphStore.getState()
  const graphDocumentName = String(((after.graphData?.metadata || {}) as Record<string, unknown>).markdownDocumentName || '')
  if (firstApplied) throw new Error('expected superseded first document apply to fail its active-document guard')
  if (!secondApplied) throw new Error('expected queued video preset apply to await its own graph commit')
  if (after.markdownDocumentName !== 'docs/video-preset.md' || graphDocumentName !== 'docs/video-preset.md') {
    throw new Error(`expected queued apply to commit the exact active document graph, got ${JSON.stringify({ active: after.markdownDocumentName, graphDocumentName })}`)
  }
}

export async function testQueuedMarkdownApplyCoalescesExactDocumentIdentity() {
  const state = useGraphStore.getState()
  state.resetAll()
  const firstApply = state.setActiveMarkdownDocument({
    name: 'docs/first.md',
    text: '# First document\n\nAlpha',
    applyViewPreset: false,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  const presetText = [
    '---',
    'kgCanvasRenderMode: 2d',
    'kgCanvas2dRenderer: storyboard',
    'kgFrontmatterModeEnabled: true',
    '---',
    '# Video preset document',
    '',
    'Beta',
  ].join('\n')
  const activatingPreset = useGraphStore.getState().setActiveMarkdownDocument({
    name: 'docs/video-preset.md',
    text: presetText,
    applyViewPreset: true,
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  const equivalentImplicitPresetApply = useGraphStore.getState().applyMarkdownDocumentToGraph(
    'docs/video-preset.md',
    presetText,
    {
      force: false,
      applyViewPreset: false,
      requireActiveMarkdownDocument: false,
    },
  )
  const [firstApplied, presetActivated, equivalentApplied] = await Promise.all([
    firstApply,
    activatingPreset,
    equivalentImplicitPresetApply,
  ])
  const after = useGraphStore.getState()
  const graphDocumentName = String(((after.graphData?.metadata || {}) as Record<string, unknown>).markdownDocumentName || '')
  if (firstApplied) throw new Error('expected the superseded first document apply to fail')
  if (!presetActivated || !equivalentApplied) {
    throw new Error(`expected equivalent preset forms and execution policies to share one exact graph commit, got ${JSON.stringify({ presetActivated, equivalentApplied })}`)
  }
  if (after.markdownDocumentName !== 'docs/video-preset.md' || graphDocumentName !== 'docs/video-preset.md') {
    throw new Error(`expected the exact document identity to commit the requested graph, got ${JSON.stringify({ active: after.markdownDocumentName, graphDocumentName })}`)
  }
}

export async function testImportedWorkspaceActivationRetriesOnePassiveDocumentCollision() {
  const targetPath = '/video-preset.md'
  const canonicalAliasPath = '/docs/video-preset.md'
  const targetText = '# Video preset\n\nGenerate the source-backed package.'
  const workspace = createMemoryWorkspaceFs({
    initialEntries: [
      { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
      { path: '/docs', parentPath: '/', kind: 'folder', name: 'docs', updatedAtMs: 1 },
      { path: targetPath, parentPath: '/', kind: 'file', name: 'video-preset.md', text: targetText, updatedAtMs: 1 },
      { path: canonicalAliasPath, parentPath: '/docs', kind: 'file', name: 'video-preset.md', text: targetText, updatedAtMs: 1 },
    ],
  })
  const state = useGraphStore.getState()
  state.resetAll()
  useMarkdownExplorerStore.setState({ activePath: null })
  const originalSetActiveMarkdownDocument = useGraphStore.getState().setActiveMarkdownDocument
  let activationAttempts = 0
  useGraphStore.setState({
    setActiveMarkdownDocument: async payload => {
      activationAttempts += 1
      if (activationAttempts !== 1) return originalSetActiveMarkdownDocument(payload)
      const firstAttempt = originalSetActiveMarkdownDocument(payload)
      await Promise.resolve()
      useMarkdownExplorerStore.setState({ activePath: canonicalAliasPath })
      await originalSetActiveMarkdownDocument({
        name: 'docs/video-preset.md',
        text: targetText,
        normalizeMermaidMmd: false,
        applyViewPreset: false,
      })
      return firstAttempt
    },
  })
  let activated = false
  try {
    activated = await activateFirstImportedWorkspaceFile({
      fs: workspace,
      createdPaths: [targetPath],
      applyToGraph: true,
    })
  } finally {
    useGraphStore.setState({ setActiveMarkdownDocument: originalSetActiveMarkdownDocument })
  }
  const after = useGraphStore.getState()
  const graphDocumentName = String(((after.graphData?.metadata || {}) as Record<string, unknown>).markdownDocumentName || '')
  if (!activated || activationAttempts !== 2) {
    throw new Error(`expected one bounded retry after an equivalent source-path collision, got ${JSON.stringify({ activated, activationAttempts })}`)
  }
  if (after.markdownDocumentName !== 'docs/video-preset.md' || graphDocumentName !== 'docs/video-preset.md') {
    throw new Error(`expected the retry to commit the selected imported document, got ${JSON.stringify({ active: after.markdownDocumentName, graphDocumentName })}`)
  }
}
