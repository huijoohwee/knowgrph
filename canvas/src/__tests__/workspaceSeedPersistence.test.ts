import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { readEnvString, readEnvStringFromRecord } from '@/lib/config.env'
import { useGraphStore } from '@/hooks/useGraphStore'
import { materializeActiveWorkspaceEntryIntoSourceFiles } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import {
  LEGACY_WORKSPACE_README_PATH,
  LEGACY_WORKSPACE_TRIP_DEMO_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
  resolveWorkspaceStartupActivePath,
  sortWorkspaceEntriesForExplorer,
} from '@/features/workspace-fs/workspaceFs'

export async function testWorkspaceEnsureSeedDoesNotReseedAfterUserDeletesAllFiles() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()

    const seeded = await fs.listEntries()
    const seededFiles = seeded.filter(e => e.kind === 'file')
    if (seededFiles.length === 0) throw new Error('expected seed files to exist after ensureSeed')

    for (const f of seededFiles) {
      await fs.deleteEntry(f.path)
    }

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
      ],
    })
    await fs.ensureSeed()

    const entries = await fs.listEntries()
    const filePaths = new Set(entries.filter(e => e.kind === 'file').map(e => String(e.path || '')))
    if (filePaths.has(LEGACY_WORKSPACE_TRIP_DEMO_PATH)) {
      throw new Error('expected legacy trip demo workspace seed to be removed during validation demo migration')
    }
    if (!filePaths.has(WORKSPACE_README_SEED_PATH)) {
      throw new Error('expected README workspace seed to be present after legacy seed migration')
    }
    if (!filePaths.has(TEST_VALIDATION_WORKSPACE_SEED_PATH)) {
      throw new Error('expected validation demo workspace seed to remain present after legacy seed migration')
    }
    if (filePaths.size !== 2) {
      throw new Error(`expected exactly two default workspace seed files after migration, got ${String(filePaths.size)}`)
    }
    const readmeEntry = entries.find(e => e.path === WORKSPACE_README_SEED_PATH && e.kind === 'file')
    if (!readmeEntry || typeof readmeEntry.text !== 'string' || !readmeEntry.text.includes('kgCanvas2dRenderer: "d3"')) {
      throw new Error('expected migrated README workspace seed to replace the legacy placeholder content with the real D3 preload seed')
    }
  } finally {
    restore()
  }
}

export async function testWorkspaceEnsureSeedReconcilesPartialCanonicalSeedFamily() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs({
      initialEntries: [
        { path: '/', parentPath: null, kind: 'folder', name: '', updatedAtMs: 1 },
        { path: WORKSPACE_README_SEED_PATH, parentPath: '/', kind: 'file', name: 'README.md', text: '', updatedAtMs: 1 },
      ],
    })
    await fs.ensureSeed()

    const entries = await fs.listEntries()
    const readmeEntry = entries.find(e => e.path === WORKSPACE_README_SEED_PATH && e.kind === 'file')
    const validationEntry = entries.find(e => e.path === TEST_VALIDATION_WORKSPACE_SEED_PATH && e.kind === 'file')
    if (!readmeEntry || typeof readmeEntry.text !== 'string' || !readmeEntry.text.includes('kgCanvas2dRenderer: "d3"')) {
      throw new Error('expected partial canonical seed family to repair empty README with the D3 preload seed')
    }
    if (!validationEntry || typeof validationEntry.text !== 'string' || !validationEntry.text.includes('kgCanvas2dRenderer: "flowEditor"')) {
      throw new Error('expected partial canonical seed family to restore the validation demo seed')
    }
  } finally {
    restore()
  }
}

export function testWorkspaceStartupActivePathPrefersReadmeForDefaultSeedFamily() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
    ],
    activePath: TEST_VALIDATION_WORKSPACE_SEED_PATH,
    preferValidationSeedForDefaultFamily: false,
  })
  if (next !== WORKSPACE_README_SEED_PATH) {
    throw new Error(`expected default seed startup to prefer README, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathPrefersValidationSeedForCustomValidationTarget() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
    ],
    activePath: WORKSPACE_README_SEED_PATH,
    preferValidationSeedForDefaultFamily: true,
  })
  if (next !== TEST_VALIDATION_WORKSPACE_SEED_PATH) {
    throw new Error(`expected custom validation target startup to prefer validation seed, got ${String(next)}`)
  }
}

export function testWorkspaceStartupActivePathForcesValidationSeedWhenCustomTargetExists() {
  const next = resolveWorkspaceStartupActivePath({
    workspaceFilePaths: [
      WORKSPACE_README_SEED_PATH,
      TEST_VALIDATION_WORKSPACE_SEED_PATH,
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
      'sandbox/test-data/knowgrph-rich-media-generation-demo.md',
    )
    if (next !== 'huijoohwee.github.io/template/knowgrph-video-script-template.md') {
      throw new Error(`expected process env fallback to resolve custom validation target, got ${String(next)}`)
    }
  } finally {
    if (typeof prev === 'string') process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH = prev
    else delete process.env.VITE_TEST_VALIDATION_SOURCE_FILE_REL_PATH
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
