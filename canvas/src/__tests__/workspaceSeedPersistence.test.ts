import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { readEnvString, readEnvStringFromRecord } from '@/lib/config.env'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import { getWorkspaceFs, resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import {
  buildInitialWorkspaceStartupSnapshot,
  buildMaterializedWorkspaceActivePathKey,
  buildMaterializedWorkspaceForceIncludePaths,
  materializeActiveWorkspaceEntryIntoSourceFiles,
  readReusableWorkspaceEntriesSnapshot,
  resolveMaterializedWorkspaceActivePath,
  resolveWorkspaceMaterializationEntries,
} from '@/features/source-files/sourceFilesRuntimeShared'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import {
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
  LEGACY_GEOSPATIAL_WORKSPACE_SEED_PATH,
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
  resolveWorkspaceStartupActivePath,
  sortWorkspaceEntriesForExplorer,
} from '@/features/workspace-fs/workspaceFs'
import {
  resolveWorkspaceSourceIndexSnapshot,
  readReusableWorkspaceSourceIndexSnapshot,
  setWorkspaceEntrySource,
} from '@/features/workspace-fs/sourceIndex'
import {
  buildFailedWorkspaceRefreshSnapshot,
  pruneWorkspaceEntriesForInlineSnapshot,
  buildWorkspaceRefreshSnapshot,
} from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared'
import {
  resolveWorkspaceEntryInlineText,
  resolveWorkspaceSourceFileInlineText,
  upsertWorkspaceEntryInlineText,
} from '@/features/workspace-fs/workspaceInlineText'
import {
  applyActiveMarkdownDocumentPayload,
  buildActiveMarkdownDocumentPayload,
} from '@/features/markdown/activeMarkdownDocument'
import { readWorkspaceInitializationSeedText, upsertWorkspaceInitializationSeedText } from '@/features/workspace-fs/workspaceSeedProvider'

export async function testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        { path: '/notes/custom.md', parentPath: '/notes', kind: 'file', name: 'custom.md', text: '# Custom', updatedAtMs: 1 },
      ],
    })

    await fs.deleteEntry('/notes/custom.md' as never)

    const afterDelete = await fs.listEntries()
    if (afterDelete.some(e => e.kind === 'file')) throw new Error('expected all files deleted')

    await fs.ensureSeed()
    const afterEnsureSeedAgain = await fs.listEntries()
    if (afterEnsureSeedAgain.some(e => e.kind === 'file')) {
      throw new Error('expected ensureSeed not to reseed after user deleted all files')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceEnsureSeedMigratesLegacyDefaultsToReadmeAndValidationDemo() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        { path: LEGACY_WORKSPACE_README_PATH, parentPath: '/', kind: 'file', name: 'README.md', text: '# Workspace', updatedAtMs: 1 },
        { path: LEGACY_WORKSPACE_TRIP_DEMO_PATH, parentPath: '/', kind: 'file', name: 'trip-demo-mmd.md', text: '# Trip demo', updatedAtMs: 1 },
        { path: LEGACY_GEOSPATIAL_WORKSPACE_SEED_PATH, parentPath: '/', kind: 'file', name: 'knowgrph-maps-grabmap-multim-demo.md', text: '# Maps demo', updatedAtMs: 1 },
      ],
    })
    await fs.ensureSeed()

    const entries = await fs.listEntries()
    const filePaths = new Set(entries.filter(e => e.kind === 'file').map(e => String(e.path || '')))
    if (filePaths.has(LEGACY_WORKSPACE_TRIP_DEMO_PATH)) {
      throw new Error('expected legacy trip demo workspace seed to be removed during validation demo migration')
    }
    if (filePaths.has(LEGACY_GEOSPATIAL_WORKSPACE_SEED_PATH)) {
      throw new Error('expected legacy geospatial workspace seed to be removed during canonical seed-family migration')
    }
    if (!filePaths.has(WORKSPACE_README_SEED_PATH)) {
      throw new Error('expected README workspace seed to be present after legacy seed migration')
    }
    if (!filePaths.has(TEST_VALIDATION_WORKSPACE_SEED_PATH)) {
      throw new Error('expected validation demo workspace seed to remain present after legacy seed migration')
    }
    if (!filePaths.has(GEOSPATIAL_WORKSPACE_SEED_PATH)) {
      throw new Error('expected geospatial workspace seed to be added during canonical seed-family migration')
    }
    if (filePaths.size !== 3) {
      throw new Error(`expected exactly three default workspace seed files after migration, got ${String(filePaths.size)}`)
    }
    const readmeEntry = entries.find(e => e.path === WORKSPACE_README_SEED_PATH && e.kind === 'file')
    const geospatialEntry = entries.find(e => e.path === GEOSPATIAL_WORKSPACE_SEED_PATH && e.kind === 'file')
    if (!readmeEntry || typeof readmeEntry.text !== 'string' || !readmeEntry.text.includes('kgCanvas2dRenderer: "d3"')) {
      throw new Error('expected migrated README workspace seed to replace the legacy placeholder content with the real D3 preload seed')
    }
    if (!geospatialEntry || typeof geospatialEntry.text !== 'string' || !geospatialEntry.text.includes('kgCanvasSurfaceMode: "geospatial"')) {
      throw new Error('expected migrated geospatial workspace seed to carry the canonical geospatial frontmatter preset')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceEnsureSeedKeepsUserDeletedDefaultSeedEntryRemoved() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        {
          path: WORKSPACE_README_SEED_PATH,
          parentPath: '/',
          kind: 'file',
          name: 'README.md',
          text: [
            '---',
            'kgCanvas2dRenderer: "d3"',
            'kgFrontmatterModeEnabled: true',
            '---',
            '# README',
          ].join('\n'),
          updatedAtMs: 1,
        },
        {
          path: TEST_VALIDATION_WORKSPACE_SEED_PATH,
          parentPath: '/',
          kind: 'file',
          name: TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
          text: [
            '---',
            'kgCanvas2dRenderer: "flowEditor"',
            'kgFrontmatterModeEnabled: true',
            '---',
            '# Validation',
          ].join('\n'),
          updatedAtMs: 1,
        },
        {
          path: GEOSPATIAL_WORKSPACE_SEED_PATH,
          parentPath: '/',
          kind: 'file',
          name: 'knowgrph-maps-grabmap-multim-demo.md',
          text: [
            '---',
            'kgCanvasSurfaceMode: "geospatial"',
            'kgCanvas2dRenderer: "flowEditor"',
            'kgFrontmatterModeEnabled: true',
            '---',
            '# Geospatial',
          ].join('\n'),
          updatedAtMs: 1,
        },
      ],
    })
    await fs.ensureSeed()

    const entries = await fs.listEntries()
    const readmeEntry = entries.find(e => e.path === WORKSPACE_README_SEED_PATH && e.kind === 'file')
    const geospatialEntry = entries.find(e => e.path === GEOSPATIAL_WORKSPACE_SEED_PATH && e.kind === 'file')
    if (!readmeEntry || typeof readmeEntry.text !== 'string' || !readmeEntry.text.includes('kgCanvas2dRenderer: "d3"')) {
      throw new Error('expected README seed entry to exist before deletion')
    }
    if (!geospatialEntry || typeof geospatialEntry.text !== 'string' || !geospatialEntry.text.includes('kgCanvasSurfaceMode: "geospatial"')) {
      throw new Error('expected geospatial seed entry to exist before deletion')
    }

    const fsWithoutValidation = createMemoryWorkspaceFs({
      initialEntries: entries.filter(entry => entry.path !== TEST_VALIDATION_WORKSPACE_SEED_PATH),
    })
    await fsWithoutValidation.ensureSeed()
    const afterDelete = await fsWithoutValidation.listEntries()
    if (afterDelete.some(e => e.path === TEST_VALIDATION_WORKSPACE_SEED_PATH && e.kind === 'file')) {
      throw new Error('expected deleted default seed entry to stay removed after ensureSeed')
    }
  } finally {
    restore()
  }
}

export function testWorkspaceStartupActivePathPrefersValidationSeedForDefaultSeedFamily() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
      GEOSPATIAL_WORKSPACE_SEED_PATH,
    ],
    activePath: TEST_VALIDATION_WORKSPACE_SEED_PATH,
    preferValidationSeedForDefaultFamily: true,
  })
  if (next !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected default seed startup to prefer validation seed, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathPrefersValidationSeedForCustomValidationTarget() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
      GEOSPATIAL_WORKSPACE_SEED_PATH,
    ],
    activePath: null,
    preferValidationSeedForDefaultFamily: true,
  })
  if (next !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected custom validation target startup to prefer validation seed, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathPreservesExplicitDefaultSeedSelection() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
      GEOSPATIAL_WORKSPACE_SEED_PATH,
    ],
    activePath: WORKSPACE_README_SEED_PATH,
    preferValidationSeedForDefaultFamily: true,
  })
  if (next !== WORKSPACE_README_SEED_PATH) {
    throw new Error(`expected explicit default seed selection to be preserved, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathForcesValidationSeedWhenCustomTargetExists() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
      GEOSPATIAL_WORKSPACE_SEED_PATH,
      '/notes/knowgrph-pitchdeck.md',
    ],
    activePath: '/notes/knowgrph-pitchdeck.md' as never,
    preferValidationSeedForDefaultFamily: true,
    forceValidationSeedIfPresent: true,
  })
  if (next !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected custom validation target startup to force validation seed when present, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathPreservesCustomWorkspaceSelection() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
      GEOSPATIAL_WORKSPACE_SEED_PATH,
      '/notes/custom.md',
    ],
    activePath: TEST_VALIDATION_WORKSPACE_SEED_PATH,
  })
  if (next !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected custom workspace startup to preserve the requested active path, got ${String(next)}`)
  }
}

export function testWorkspaceExplorerSortPrefersReadmeFirstForCanonicalDefaultFamily() {
  const next = sortWorkspaceEntriesForExplorer([
    {
      kind: 'folder',
      path: '/sandbox',
      parentPath: '/',
      name: 'sandbox',
      updatedAtMs: 1,
    },
    {
      kind: 'file',
      path: WORKSPACE_README_SEED_PATH,
      parentPath: '/',
      name: 'README.md',
      text: '# README',
      updatedAtMs: 1,
    },
  ])
  if (next[0]?.path !== WORKSPACE_README_SEED_PATH) {
    throw new Error(`expected canonical explorer order to show README first, got ${String(next[0]?.path || '')}`)
  }
}

export function testWorkspaceExplorerSortKeepsFoldersFirstForCustomWorkspaceEntries() {
  const next = sortWorkspaceEntriesForExplorer([
    {
      kind: 'folder',
      path: '/sandbox',
      parentPath: '/',
      name: 'sandbox',
      updatedAtMs: 1,
    },
    {
      kind: 'file',
      path: '/notes.md',
      parentPath: '/',
      name: 'notes.md',
      text: '# Notes',
      updatedAtMs: 1,
    },
  ])
  if (next[0]?.path !== '/sandbox') {
    throw new Error(`expected non-default explorer order to keep folders first, got ${String(next[0]?.path || '')}`)
  }
}

export function testCanvasEnvBridgeReadsImportMetaStyleRecordFirst() {
  const next = readEnvStringFromRecord(
    {
      VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH: 'huijoohwee.github.io/template/knowgrph-video-script-template.md',
    },
    'VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH',
  )
  if (next !== 'huijoohwee.github.io/template/knowgrph-video-script-template.md') {
    throw new Error(`expected import-meta style env record to win, got ${String(next)}`)
  }
}

export function testCanvasEnvBridgeFallsBackToProcessEnvOutsideBrowser() {
  const prev = process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH
  process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH = 'huijoohwee.github.io/template/knowgrph-video-script-template.md'
  try {
    const next = readEnvString(
      'VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH',
      'sandbox/test-data/test-generate-video/knowgrph-demo-video.md',
    )
    if (next !== 'huijoohwee.github.io/template/knowgrph-video-script-template.md') {
      throw new Error(`expected process env fallback to resolve custom validation target, got ${String(next)}`)
    }
  } finally {
    if (typeof prev === 'string') process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH = prev
    else delete process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH
  }
}

export function testCanvasEnvBridgeReadsKnowgrphStorageBaseUrlFromProcessEnv() {
  const prev = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = 'http://127.0.0.1:8787'
  try {
    const next = readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', '')
    if (next !== 'http://127.0.0.1:8787') {
      throw new Error(`expected storage base url to be readable through canvas env bridge, got ${String(next)}`)
    }
  } finally {
    if (typeof prev === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = prev
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  }
}

export async function testWorkspaceBootstrapMaterializesActiveWorkspaceEntryIntoParsedSourceFile() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        {
          path: '/huijoohwee.github.io/template/knowgrph-video-script-template.md',
          parentPath: '/huijoohwee.github.io/template',
          kind: 'file',
          name: 'knowgrph-video-script-template.md',
          text: [
            '---',
            'title: "Knowgrph · Video Script Template"',
            'kgCanvasRenderMode: "2d"',
            'kgCanvas2dRenderer: "flowEditor"',
            'kgDocumentSemanticMode: "document"',
            'kgFrontmatterModeEnabled: true',
            'flow:',
            '  nodes:',
            '    - id: start',
            '      label: Start',
            '      type: Text',
            '    - id: end',
            '      label: End',
            '      type: Text',
            '  edges:',
            '    - id: e1',
            '      source: start',
            '      target: end',
            '      type: bezier',
            '---',
            '',
            '# Validation',
            '',
            'Bootstrap parse should materialize this file.',
          ].join('\n'),
          updatedAtMs: 1,
        },
      ],
    })
    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: '/huijoohwee.github.io/template/knowgrph-video-script-template.md' as never,
      fs,
      applyToGraph: true,
    })
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const state = useGraphStore.getState()
    const sourceFile = state.sourceFiles.find(
      file => file.source?.path === 'workspace:/huijoohwee.github.io/template/knowgrph-video-script-template.md',
    )
    if (!sourceFile) {
      throw new Error('expected bootstrap materialization to mirror the active workspace file into Source Files')
    }
    if (sourceFile.enabled !== true) {
      throw new Error('expected active workspace bootstrap materialization to keep the source file enabled')
    }
    if (sourceFile.status !== 'parsed') {
      throw new Error(`expected bootstrap materialization to parse the active workspace file, got ${String(sourceFile.status || '')}`)
    }
    if (!sourceFile.parsedGraphData || (sourceFile.parsedGraphData.nodes || []).length < 2) {
      throw new Error('expected bootstrap materialization to populate parsedGraphData for the active workspace file')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceBootstrapMaterializeReusesProvidedWorkspaceSnapshotWithoutExtraListEntries() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    const baseFs = createMemoryWorkspaceFs()
    let listEntriesCalls = 0
    const fs: WorkspaceFs = {
      ...baseFs,
      listEntries: async () => {
        listEntriesCalls += 1
        return baseFs.listEntries()
      },
    }
    await fs.ensureSeed()
    const workspaceEntries = await fs.listEntries()
    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: WORKSPACE_README_SEED_PATH as never,
      fs,
      workspaceEntries,
      sourcesByPath: {},
      applyToGraph: true,
    })
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    if (listEntriesCalls !== 1) {
      throw new Error(`expected bootstrap materialization to reuse provided workspace entries, got ${String(listEntriesCalls)} listEntries calls`)
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceBootstrapMaterializeDoesNotApplyGraphWithoutExplicitOptIn() {
  const { restore } = initJsdomHarness()
  try {
    useGraphStore.getState().resetAll()
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        {
          path: '/notes/imported.md',
          parentPath: '/notes',
          kind: 'file',
          name: 'imported.md',
          text: [
            '---',
            'title: Imported',
            'kgCanvasRenderMode: "2d"',
            'kgCanvas2dRenderer: "flowEditor"',
            'kgDocumentSemanticMode: "document"',
            'kgFrontmatterModeEnabled: true',
            'flow:',
            '  nodes:',
            '    - id: a',
            '      type: Text',
            '      label: A',
            '    - id: b',
            '      type: Text',
            '      label: B',
            '  edges:',
            '    - id: e1',
            '      source: a',
            '      target: b',
            '---',
            '',
            '# Imported',
          ].join('\n'),
          updatedAtMs: 1,
        },
      ],
    })
    const state = useGraphStore.getState()
    state.setGraphData({ nodes: [{ id: 'keep', type: 'Text', x: 0, y: 0 } as never], edges: [] as never, metadata: {} as never } as never)
    await materializeActiveWorkspaceEntryIntoSourceFiles({
      activePathOverride: '/notes/imported.md' as never,
      fs,
    })
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const after = useGraphStore.getState()
    if (!after.graphData || (after.graphData.nodes || []).length !== 1 || String(after.graphData.nodes?.[0]?.id || '') !== 'keep') {
      throw new Error('expected bootstrap workspace materialization to avoid graph apply unless explicitly opted in')
    }
    const sourceFile = after.sourceFiles.find(file => file.source?.path === 'workspace:/notes/imported.md')
    if (!sourceFile) {
      throw new Error('expected bootstrap workspace materialization to still mirror the active file into Source Files')
    }
    if (sourceFile.enabled !== true) {
      throw new Error('expected bootstrap workspace materialization to keep the active source file enabled without applying graph state')
    }
  } finally {
    restore()
  }
}

export function testWorkspaceBootstrapMaterializeNormalizesActiveWorkspacePathResolution() {
  const normalizedFromOverride = resolveMaterializedWorkspaceActivePath({
    activePathOverride: ' workspace:/notes/demo.md/ ' as never,
  })
  if (normalizedFromOverride !== '/notes/demo.md') {
    throw new Error(`expected workspace materialization active-path helper to normalize override paths, got ${String(normalizedFromOverride)}`)
  }

  const normalizedFromExplorer = resolveMaterializedWorkspaceActivePath({
    explorerActivePath: '\\notes\\demo.md\\' as never,
  })
  if (normalizedFromExplorer !== '/notes/demo.md') {
    throw new Error(`expected workspace materialization active-path helper to normalize explorer paths, got ${String(normalizedFromExplorer)}`)
  }

  const missing = resolveMaterializedWorkspaceActivePath({
    activePathOverride: ' / ' as never,
  })
  if (missing !== null) {
    throw new Error('expected workspace materialization active-path helper to treat the workspace root as a non-materializable file path')
  }

  const key = buildMaterializedWorkspaceActivePathKey({
    explorerActivePath: 'workspace:/notes/demo.md/' as never,
  })
  if (key !== '/notes/demo.md') {
    throw new Error(`expected workspace materialization active-path key helper to reuse canonical normalized path strings, got ${String(key)}`)
  }

  const forceIncludePaths = buildMaterializedWorkspaceForceIncludePaths({
    explorerActivePath: 'workspace:/notes/demo.md/' as never,
  })
  if (forceIncludePaths.length !== 1 || forceIncludePaths[0] !== '/notes/demo.md') {
    throw new Error('expected workspace materialization force-include helper to reuse the canonical normalized active workspace path')
  }
}

export async function testWorkspaceBootstrapMaterializeSharedSnapshotHelpersCentralizeReuseRules() {
  const baseFs = createMemoryWorkspaceFs()
  let listEntriesCalls = 0
  const fs: WorkspaceFs = {
    ...baseFs,
    listEntries: async () => {
      listEntriesCalls += 1
      return baseFs.listEntries()
    },
  }
  await fs.ensureSeed()
  const workspaceEntries = await fs.listEntries()

  const reused = await resolveWorkspaceMaterializationEntries({
    fs,
    workspaceEntries,
  })
  if (reused !== workspaceEntries) {
    throw new Error('expected shared workspace materialization entries helper to reuse the provided snapshot by identity')
  }

  const relisted = await resolveWorkspaceMaterializationEntries({ fs })
  if (!Array.isArray(relisted) || relisted.length === 0) {
    throw new Error('expected shared workspace materialization entries helper to relist workspace entries when no snapshot is provided')
  }
  if (listEntriesCalls !== 2) {
    throw new Error(`expected shared workspace materialization entries helper to avoid extra relists when a snapshot is provided, got ${String(listEntriesCalls)} listEntries calls`)
  }

  const reusableSnapshot = readReusableWorkspaceEntriesSnapshot(workspaceEntries)
  if (reusableSnapshot !== workspaceEntries) {
    throw new Error('expected shared workspace snapshot reuse helper to keep non-empty snapshots intact')
  }
  if (readReusableWorkspaceEntriesSnapshot([]) !== undefined) {
    throw new Error('expected shared workspace snapshot reuse helper to drop empty snapshots so callers can relist when needed')
  }

  const skippedSnapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath: '/README.md' as never,
    desiredActivePath: '/README.md' as never,
    workspaceEntries,
    lastSetActivePath: true,
    preferCustomValidationSeed: false,
  })
  if (skippedSnapshot.activePath !== '/README.md' || skippedSnapshot.workspaceEntries.length !== 0) {
    throw new Error('expected shared startup snapshot helper to reuse the current active path while omitting redundant workspace relist payloads')
  }

  const changedSnapshot = buildInitialWorkspaceStartupSnapshot({
    currentActivePath: '/README.md' as never,
    desiredActivePath: '/notes/demo.md' as never,
    workspaceEntries,
    lastSetActivePath: true,
    preferCustomValidationSeed: false,
  })
  if (changedSnapshot.activePath !== '/notes/demo.md' || changedSnapshot.workspaceEntries !== workspaceEntries) {
    throw new Error('expected shared startup snapshot helper to preserve the provided snapshot when startup must materialize a different active file')
  }
}

export function testWorkspaceSourceIndexSnapshotHelpersCentralizeReuseRules() {
  const provided: Record<string, { kind: 'local'; originalName?: string | null }> = {
    '/notes/demo.md': { kind: 'local', originalName: 'demo.md' },
  }
  if (readReusableWorkspaceSourceIndexSnapshot(provided as never) !== (provided as never)) {
    throw new Error('expected shared workspace source-index snapshot helper to preserve provided snapshots by identity')
  }

  if (readReusableWorkspaceSourceIndexSnapshot(null) !== undefined) {
    throw new Error('expected shared workspace source-index snapshot helper to ignore missing snapshots')
  }

  if (resolveWorkspaceSourceIndexSnapshot(provided as never) !== (provided as never)) {
    throw new Error('expected shared workspace source-index resolver to reuse provided snapshots without reloading the cached source index')
  }

  const cached = setWorkspaceEntrySource('/notes/cached.md' as never, { kind: 'url', url: 'https://example.com/cached.md' })
  const resolved = resolveWorkspaceSourceIndexSnapshot(undefined)
  if (resolved !== cached) {
    throw new Error('expected shared workspace source-index resolver to fall back to the canonical cached source index when no snapshot is provided')
  }
}

export function testWorkspaceRefreshSnapshotHelpersCentralizeFallbackState() {
  const providedSources = {
    '/notes/demo.md': { kind: 'local', originalName: 'demo.md' },
  } as const
  const providedEntries = [
    { path: '/notes/demo.md', parentPath: '/notes', kind: 'file', name: 'demo.md', updatedAtMs: 1 },
  ] as unknown as import('@/features/workspace-fs/types').WorkspaceEntry[]

  const built = buildWorkspaceRefreshSnapshot({
    entries: providedEntries,
    sourcesByPath: providedSources as never,
  })
  if (built.entries !== providedEntries || built.sourcesByPath !== (providedSources as never)) {
    throw new Error('expected shared workspace refresh snapshot helper to preserve provided entries and source-index snapshots by identity')
  }

  const failed = buildFailedWorkspaceRefreshSnapshot()
  if (!Array.isArray(failed.entries) || failed.entries.length !== 0) {
    throw new Error('expected shared workspace refresh failure snapshot helper to return empty entries')
  }

  const cached = setWorkspaceEntrySource('/notes/refresh-cached.md' as never, { kind: 'url', url: 'https://example.com/refresh-cached.md' })
  const fallback = buildWorkspaceRefreshSnapshot({
    entries: providedEntries,
  })
  if (fallback.sourcesByPath !== cached) {
    throw new Error('expected shared workspace refresh snapshot helper to reuse the canonical cached source index when no snapshot is provided')
  }
}

export function testWorkspaceRefreshPruningHelperCentralizesOversizedInlineTextRule() {
  const safeEntries = [
    { path: '/notes/a.md', parentPath: '/notes', kind: 'file', name: 'a.md', text: 'short', updatedAtMs: 1 },
    { path: '/notes', parentPath: '/', kind: 'folder', name: 'notes', updatedAtMs: 1 },
  ] as unknown as import('@/features/workspace-fs/types').WorkspaceEntry[]
  const safeResult = pruneWorkspaceEntriesForInlineSnapshot(safeEntries, 10)
  if (safeResult !== safeEntries) {
    throw new Error('expected shared workspace refresh pruning helper to preserve entry-array identity when no oversized inline text needs pruning')
  }

  const oversizedEntries = [
    { path: '/notes/large.md', parentPath: '/notes', kind: 'file', name: 'large.md', text: '0123456789ABC', updatedAtMs: 1 },
    { path: '/notes/small.md', parentPath: '/notes', kind: 'file', name: 'small.md', text: 'small', updatedAtMs: 1 },
  ] as unknown as import('@/features/workspace-fs/types').WorkspaceEntry[]
  const pruned = pruneWorkspaceEntriesForInlineSnapshot(oversizedEntries, 10)
  if (pruned === oversizedEntries) {
    throw new Error('expected shared workspace refresh pruning helper to create a new snapshot when oversized inline text must be dropped')
  }
  if (typeof pruned[0]?.text !== 'undefined') {
    throw new Error('expected shared workspace refresh pruning helper to drop oversized inline file text')
  }
  if (pruned[1] !== oversizedEntries[1]) {
    throw new Error('expected shared workspace refresh pruning helper to preserve identity for entries that do not need pruning')
  }
}

export function testWorkspaceInlineTextHelpersCentralizeEntryAndSourceFileRules() {
  if (resolveWorkspaceEntryInlineText('012345', 5) !== undefined) {
    throw new Error('expected workspace entry inline-text helper to drop oversized entry text')
  }
  if (resolveWorkspaceEntryInlineText('short', 5) !== 'short') {
    throw new Error('expected workspace entry inline-text helper to preserve bounded entry text')
  }
  if (resolveWorkspaceSourceFileInlineText('012345', 5) !== '') {
    throw new Error('expected workspace source-file inline-text helper to convert oversized text into an empty source-file payload')
  }

  const entries = [
    { path: '/notes/demo.md', parentPath: '/notes', kind: 'file', name: 'demo.md', text: 'old', updatedAtMs: 1 },
  ] as unknown as import('@/features/workspace-fs/types').WorkspaceEntry[]
  const unchanged = upsertWorkspaceEntryInlineText({
    entries,
    path: '/notes/demo.md' as never,
    text: 'old',
    updatedAtMs: 2,
  })
  if (unchanged !== entries) {
    throw new Error('expected workspace entry inline-text helper to preserve entry-array identity when inline text is unchanged')
  }

  const inserted = upsertWorkspaceEntryInlineText({
    entries: [],
    path: '/notes/added.md' as never,
    text: 'fresh',
    createIfMissing: true,
    updatedAtMs: 3,
  })
  if (inserted.length !== 1 || inserted[0]?.path !== '/notes/added.md' || inserted[0]?.text !== 'fresh') {
    throw new Error('expected workspace entry inline-text helper to centralize missing-entry creation with normalized inline text')
  }
}

export async function testActiveMarkdownDocumentHelpersCentralizePayloadDefaults() {
  const calls: Array<ReturnType<typeof buildActiveMarkdownDocumentPayload>> = []
  const base = buildActiveMarkdownDocumentPayload({
    name: 'demo.md',
    text: 'body',
    sourceUrl: 'https://example.com/demo',
    applyToGraph: true,
    forceApplyToGraph: true,
  })
  if (base.normalizeMermaidMmd !== false || base.sourceUrl !== 'https://example.com/demo') {
    throw new Error('expected active markdown document payload helper to centralize normalizeMermaidMmd and source-url defaults')
  }

  await applyActiveMarkdownDocumentPayload({
    setActiveMarkdownDocument: async payload => {
      calls.push(payload)
      return true
    },
    name: 'demo.md',
    text: ['---', 'kgWebpageUrl: https://example.com/demo', '---', '# Demo'].join('\n'),
    sourceUrl: 'https://example.com/demo',
    autoEnableFrontmatter: false,
    applyViewPreset: false,
    normalizeWebpageFrontmatterToMarkdown: true,
  })
  if (
    calls.length !== 1 ||
    calls[0]?.normalizeMermaidMmd !== false ||
    calls[0]?.autoEnableFrontmatter !== false ||
    calls[0]?.applyViewPreset !== false
  ) {
    throw new Error('expected active markdown document apply helper to preserve shared payload defaults across runtime/import callers')
  }
}

export async function testWorkspaceSeedProviderPrefersConfiguredAbsoluteDocsRoot() {
  const previousAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/Users/huijoohwee/Documents/GitHub/huijoohwee/docs'
  const previousFetch = globalThis.fetch
  const calls: string[] = []
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : (input as URL).toString())
    calls.push(url)
    if (url.includes('/@fs/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-video-demo.md')) {
      return new Response('# absolute docs seed', { status: 200 })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
  try {
    const text = await readWorkspaceInitializationSeedText({
      basename: 'knowgrph-video-demo.md',
      relPathCandidates: ['docs/knowgrph-video-demo.md'],
    })
    if (text !== '# absolute docs seed') {
      throw new Error(`expected absolute docs seed provider path to win, got ${String(text || '')}`)
    }
    if (!calls.some(url => url.includes('/@fs/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-video-demo.md'))) {
      throw new Error('expected workspace seed provider to probe configured absolute docs root through Vite /@fs')
    }
  } finally {
    if (typeof previousAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (previousFetch) {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = previousFetch
    } else {
      delete (globalThis as unknown as { fetch?: typeof fetch }).fetch
    }
  }
}

export async function testWorkspaceSeedProviderResolvesDocsWorkspaceSeedsFromConfiguredAbsoluteDocsRoot() {
  const previousAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/Users/huijoohwee/Documents/GitHub/huijoohwee/docs'
  const previousFetch = globalThis.fetch
  const calls: string[] = []
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : (input as URL).toString())
    calls.push(url)
    if (url.includes('/@fs/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/workspace-seeds/knowgrph-video-demo.md')) {
      return new Response('# docs workspace-seeds absolute root', { status: 200 })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
  try {
    const text = await readWorkspaceInitializationSeedText({
      basename: 'knowgrph-video-demo.md',
      relPathCandidates: ['docs/workspace-seeds/knowgrph-video-demo.md', 'docs/knowgrph-video-demo.md'],
    })
    if (text !== '# docs workspace-seeds absolute root') {
      throw new Error(`expected docs/workspace-seeds absolute docs-root seed to resolve, got ${String(text || '')}`)
    }
    if (!calls.some(url => url.includes('/@fs/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/workspace-seeds/knowgrph-video-demo.md'))) {
      throw new Error('expected workspace seed provider to probe docs/workspace-seeds path relative to configured absolute docs root')
    }
  } finally {
    if (typeof previousAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (previousFetch) {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = previousFetch
    } else {
      delete (globalThis as unknown as { fetch?: typeof fetch }).fetch
    }
  }
}

export async function testWorkspaceSeedProviderBrowserUpsertWritesViaKgFsProxy() {
  const previousWindow = globalThis.window
  const previousAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousFetch = globalThis.fetch
  const calls: Array<{ url: string; body: string }> = []
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/Users/huijoohwee/Documents/GitHub/huijoohwee/docs'
  ;(globalThis as unknown as { window: Window }).window = {
    setTimeout: ((handler: TimerHandler) => {
      if (typeof handler === 'function') handler()
      return 0 as unknown as number
    }) as Window['setTimeout'],
    clearTimeout: (() => void 0) as Window['clearTimeout'],
  } as unknown as Window
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(typeof input === 'string' ? input : (input as URL).toString()),
      body: String(init?.body || ''),
    })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const ok = await upsertWorkspaceInitializationSeedText({
      basename: 'knowgrph-video-demo.md',
      text: '# mirrored seed',
    })
    if (!ok) {
      throw new Error('expected browser upsert to succeed through /__kg_fs_write proxy')
    }
    const writeCall = calls.find(call => call.url === '/__kg_fs_write')
    if (!writeCall) {
      throw new Error('expected workspace seed provider to call /__kg_fs_write in browser mode')
    }
    if (!writeCall.body.includes('/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-video-demo.md')) {
      throw new Error('expected workspace seed provider write payload to target configured docs absolute path')
    }
  } finally {
    if (typeof previousAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (previousFetch) {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = previousFetch
    } else {
      delete (globalThis as unknown as { fetch?: typeof fetch }).fetch
    }
    if (previousWindow) {
      ;(globalThis as unknown as { window: Window }).window = previousWindow
    } else {
      delete (globalThis as unknown as { window?: Window }).window
    }
  }
}

export async function testRuntimeSourceFilesReflectWorkspaceSeedFileContentChanges() {
  const previousAbsRoot = process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
  const previousFetch = globalThis.fetch
  let root: ReturnType<typeof createRoot> | null = null
  const { restore } = initJsdomHarness()
  process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = '/Users/huijoohwee/Documents/GitHub/huijoohwee/docs'
  let docsText = '# seed v1\n\nruntime reflection baseline'
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : (input as URL).toString())
    if (url.includes('/@fs/Users/huijoohwee/Documents/GitHub/huijoohwee/docs/knowgrph-video-demo.md')) {
      return new Response(docsText, { status: 200 })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch

  const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (predicate()) return
      await new Promise<void>(resolve => setTimeout(resolve, 10))
    }
    const debugPaths = useGraphStore
      .getState()
      .sourceFiles
      .map(file => `${String(file.name || '')}::${String(file.source?.path || '')}`)
      .slice(0, 8)
    throw new Error(`timed out waiting for runtime source-file seed reflection; sourceFiles=${JSON.stringify(debugPaths)}`)
  }

  try {
    resetWorkspaceFsForTests()
    useGraphStore.getState().resetAll()
    useGraphStore.getState().setSourceFiles([])
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const entries = await fs.listEntries()
    const validationEntryPath = String(
      entries.find(entry => entry.kind === 'file' && String(entry.name || '') === 'knowgrph-video-demo.md')?.path || '',
    ).trim()
    if (!validationEntryPath) {
      throw new Error('expected runtime test workspace seed bootstrap to include knowgrph-video-demo.md entry')
    }
    useMarkdownExplorerStore.getState().setActivePath(validationEntryPath as never)
    const seededText = await fs.readFileText(validationEntryPath as never)
    if (!String(seededText || '').includes('seed v1')) {
      throw new Error(`expected workspace seed file text to load v1 before runtime mount, got ${String(seededText || '')}`)
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    await act(async () => {
      root = createRoot(container)
      root.render(React.createElement(SourceFilesPersistenceBootstrap))
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })

    docsText = '# seed v2\n\nruntime reflection updated'
    await new Promise<void>(resolve => setTimeout(resolve, 80))
    await fs.ensureSeed()
    const seededTextAfterUpdate = await fs.readFileText(validationEntryPath as never)
    if (!String(seededTextAfterUpdate || '').includes('seed v2')) {
      throw new Error(`expected workspace seed file text to update to v2, got ${String(seededTextAfterUpdate || '')}`)
    }
    await waitFor(() => {
      const file = useGraphStore.getState().sourceFiles.find(entry => {
        const sourcePath = String(entry.source?.path || '')
        const name = String(entry.name || '')
        return sourcePath.startsWith('workspace:') && (name === 'knowgrph-video-demo.md' || sourcePath.includes('knowgrph-video-demo.md'))
      })
      return Boolean(file && String(file.text || '').includes('seed v2'))
    })
  } finally {
    try {
      await act(async () => {
        root?.unmount()
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      })
    } catch {
      void 0
    }
    restore()
    resetWorkspaceFsForTests()
    if (typeof previousAbsRoot === 'string') process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT = previousAbsRoot
    else delete process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT
    if (previousFetch) {
      ;(globalThis as unknown as { fetch: typeof fetch }).fetch = previousFetch
    } else {
      delete (globalThis as unknown as { fetch?: typeof fetch }).fetch
    }
  }
}
