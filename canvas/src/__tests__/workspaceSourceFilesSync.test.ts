import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'
import {
  TEST_VALIDATION_SOURCE_PATH,
  WORKSPACE_README_SOURCE_PATH,
  reconcileDefaultWorkspaceSeedSourceFiles,
} from '@/features/source-files/workspaceSeedSourceFiles'

export async function testWorkspaceSourceFilesSyncMergesAndPreservesNonWorkspace() {
  const existing: SourceFile[] = [
    {
      id: 'remote-1',
      name: 'remote.json',
      text: '{}',
      enabled: true,
      status: 'idle',
      source: { kind: 'url', url: 'https://example.com/remote.json' },
    },
    {
      id: 'ws-prev',
      name: 'old.md',
      text: 'prev',
      enabled: false,
      status: 'parsed',
      parsedTextHash: 'h',
      parsedGraphData: { type: 'graph', nodes: [{ id: 'n1', type: 'Entity', label: 'n1', properties: {} }], edges: [] },
      source: { kind: 'local', path: 'workspace:/old.md' },
    },
  ]

  const workspaceEntries: WorkspaceEntry[] = [
    { kind: 'file', path: '/a.md', parentPath: '/', name: 'a.md', text: '# A', updatedAtMs: 1 },
    { kind: 'file', path: '/b.md', parentPath: '/', name: 'b.md', updatedAtMs: 1 },
  ]

  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries,
    sourcesByPath: { '/b.md': { kind: 'url', url: 'https://example.com/b.md' } },
  })

  const ids = new Set(next.map(f => f.id))
  if (!ids.has('remote-1')) throw new Error('expected non-workspace source file to be preserved')
  if (ids.has('ws-prev')) throw new Error('expected removed workspace file to be dropped')

  const wsA = next.find(f => f.source?.path === 'workspace:/a.md')
  if (wsA) throw new Error('expected /a.md to be omitted until explicitly added as a source')

  const wsB = next.find(f => f.source?.path === 'workspace:/b.md')
  if (!wsB) throw new Error('expected /b.md to be mapped into Source Files')
  if (wsB.source?.kind !== 'url') throw new Error('expected /b.md to carry url source kind')
  if (wsB.source?.url !== 'https://example.com/b.md') throw new Error('expected /b.md to carry url')
}

export async function testWorkspaceSourceFilesSyncForceIncludesActiveWorkspaceMarkdown() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      { kind: 'file', path: '/active.md', parentPath: '/', name: 'active.md', text: '---\ntitle: Active\n---\n', updatedAtMs: 1 },
    ],
    sourcesByPath: {},
    forceIncludePaths: ['/active.md'],
  })

  const active = next.find(f => f.source?.path === 'workspace:/active.md')
  if (!active) throw new Error('expected active workspace markdown path to be mirrored into Source Files when force-included')
  if (active.source?.kind !== 'local') throw new Error('expected active workspace markdown source kind to default to local')
  if (active.enabled !== true) throw new Error('expected newly mirrored active workspace markdown source to be enabled when force-included as the active workspace doc')
}

export async function testWorkspaceSourceFilesSyncForceIncludeReenablesExistingDisabledValidationSeed() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [
      {
        id: 'ws-validation',
        name: 'knowgrph-rich-media-generation-demo.md',
        text: '---\ntitle: Validation\n---\n',
        enabled: false,
        status: 'idle',
        source: { kind: 'local', path: TEST_VALIDATION_SOURCE_PATH },
      },
    ],
    workspaceEntries: [
      {
        kind: 'file',
        path: '/sandbox/test-data/knowgrph-rich-media-generation-demo.md',
        parentPath: '/sandbox/test-data',
        name: 'knowgrph-rich-media-generation-demo.md',
        text: '---\ntitle: Validation\nkgCanvas2dRenderer: "flowEditor"\n---\n',
        updatedAtMs: 1,
      },
    ],
    sourcesByPath: {},
    forceIncludePaths: ['/sandbox/test-data/knowgrph-rich-media-generation-demo.md'],
  })

  const validation = next.find(f => f.source?.path === TEST_VALIDATION_SOURCE_PATH)
  if (!validation) throw new Error('expected canonical validation seed to remain present in Source Files')
  if (validation.enabled !== true) {
    throw new Error('expected force-included active validation seed to be re-enabled so it participates in composed graph rendering')
  }
}

export async function testWorkspaceSourceFilesSyncAlwaysIncludesCanonicalSeedFiles() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      { kind: 'file', path: '/README.md', parentPath: '/', name: 'README.md', text: '# Readme', updatedAtMs: 1 },
      {
        kind: 'file',
        path: '/sandbox/test-data/knowgrph-rich-media-generation-demo.md',
        parentPath: '/sandbox/test-data',
        name: 'knowgrph-rich-media-generation-demo.md',
        text: '# Demo',
        updatedAtMs: 1,
      },
    ],
    sourcesByPath: {},
  })

  const readme = next.find(f => f.source?.path === WORKSPACE_README_SOURCE_PATH)
  const demo = next.find(f => f.source?.path === TEST_VALIDATION_SOURCE_PATH)
  if (!readme) throw new Error('expected canonical README seed to always be mirrored into Source Files')
  if (!demo) throw new Error('expected canonical validation demo seed to always be mirrored into Source Files')
  if (readme.enabled !== true) throw new Error('expected canonical README seed to stay enabled by default')
  if (demo.enabled !== false) throw new Error('expected canonical validation demo seed to stay disabled by default until explicitly activated')
}

export async function testWorkspaceSeedSourceFilesReconcilePersistedDefaultFamilyToCanonicalOrder() {
  const next = reconcileDefaultWorkspaceSeedSourceFiles([
    {
      id: 'legacy-demo',
      name: 'trip-demo-mmd.md',
      text: '# legacy',
      enabled: true,
      status: 'parsed',
      source: { kind: 'local', path: 'workspace:/trip-demo-mmd.md' },
    },
  ])

  if (next.length !== 2) throw new Error(`expected canonical default source-file family to contain exactly two entries, got ${next.length}`)
  if (next[0]?.source?.path !== WORKSPACE_README_SOURCE_PATH) {
    throw new Error('expected reconciled default source-file family to restore README first')
  }
  if (next[1]?.source?.path !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected reconciled default source-file family to restore validation demo second')
  }
  if (next[0]?.enabled !== true) throw new Error('expected reconciled README seed source file to stay enabled')
  if (next[1]?.enabled !== false) throw new Error('expected reconciled validation demo seed source file to stay disabled')
}

export async function testWorkspaceSeedSourceFilesReconcilePreservesEnabledValidationSeed() {
  const next = reconcileDefaultWorkspaceSeedSourceFiles([
    {
      id: 'readme',
      name: 'README.md',
      text: '# README',
      enabled: true,
      status: 'idle',
      source: { kind: 'local', path: WORKSPACE_README_SOURCE_PATH },
    },
    {
      id: 'validation',
      name: 'knowgrph-rich-media-generation-demo.md',
      text: '# Validation',
      enabled: true,
      status: 'parsed',
      source: { kind: 'local', path: TEST_VALIDATION_SOURCE_PATH },
    },
  ])

  const validation = next.find(file => file.source?.path === TEST_VALIDATION_SOURCE_PATH)
  if (!validation) throw new Error('expected canonical validation seed source file to remain present after reconciliation')
  if (validation.enabled !== true) {
    throw new Error('expected canonical seed reconciliation to preserve an already-enabled validation source file')
  }
}
