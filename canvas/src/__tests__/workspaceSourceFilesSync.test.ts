import path from 'node:path'

import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { mergeWorkspaceEntriesIntoSourceFiles, resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import {
  BUNDLED_GEOSPATIAL_WORKSPACE_SEED_PATH,
  BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH,
  GEOSPATIAL_WORKSPACE_SOURCE_PATH,
  TEST_VALIDATION_SOURCE_PATH,
  WORKSPACE_README_SOURCE_PATH,
  LEGACY_CANONICAL_GEOSPATIAL_WORKSPACE_SEED_PATH,
  LEGACY_CANONICAL_TEST_VALIDATION_WORKSPACE_SEED_PATH,
  reconcileDefaultWorkspaceSeedSourceFiles,
  resolveWorkspaceSeedSourcePath,
} from '@/features/source-files/workspaceSeedSourceFiles'
import {
  GEOSPATIAL_WORKSPACE_SEED_PATH,
  LEGACY_CANONICAL_TEST_VALIDATION_WORKSPACE_SEED_PATH as LEGACY_TEST_VALIDATION_WORKSPACE_SEED_PATH,
  WORKSPACE_README_SEED_PATH,
} from '@/features/workspace-fs/workspaceFs'

const normalizeFsPath = (value: string): string => String(value || '').replace(/\\/g, '/')
const ABSOLUTE_DOCS_VIDEO_DEMO_PATH = normalizeFsPath(
  path.resolve(process.cwd(), '..', '..', 'huijoohwee', 'docs', 'knowgrph-video-demo.md'),
)

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

export async function testWorkspaceSourceFilesSyncPreservesParsedGraphRevision() {
  const parsedGraphData = { type: 'Graph', nodes: [{ id: 'n1', type: 'Entity', label: 'n1', properties: {} }], edges: [] } as SourceFile['parsedGraphData']
  const existing: SourceFile[] = [
    {
      id: 'ws-prev',
      name: 'a.md',
      text: 'prev',
      enabled: true,
      status: 'parsed',
      parsedTextHash: 'h',
      parsedGraphRevision: 7,
      parsedGraphData,
      source: { kind: 'local', path: 'workspace:/a.md' },
    },
  ]

  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries: [{ kind: 'file', path: '/a.md', parentPath: '/', name: 'a.md', updatedAtMs: 1 }],
    sourcesByPath: { '/a.md': { kind: 'local', originalName: 'a.md' } },
  })

  if (next[0] !== existing[0]) throw new Error('expected unchanged workspace source file object to be reused')
  if (next[0]?.parsedGraphRevision !== 7) throw new Error('expected parsedGraphRevision to be preserved across workspace source sync')
}

export async function testWorkspaceSourceFilesSyncDoesNotOverwriteExistingTextWithBlankWorkspaceInlineText() {
  const existing: SourceFile[] = [
    {
      id: 'ws-video-demo',
      name: 'knowgrph-video-demo.md',
      text: '# hydrated markdown',
      enabled: true,
      status: 'parsed',
      source: { kind: 'local', path: 'workspace:/docs/knowgrph-video-demo.md' },
    },
  ]
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing,
    workspaceEntries: [
      {
        kind: 'file',
        path: '/docs/knowgrph-video-demo.md',
        parentPath: '/docs',
        name: 'knowgrph-video-demo.md',
        text: '',
        updatedAtMs: 2,
      },
    ],
    sourcesByPath: {
      '/docs/knowgrph-video-demo.md': { kind: 'local', originalName: 'knowgrph-video-demo.md' },
    },
  })
  const file = next.find(entry => String(entry.source?.path || '') === 'workspace:/docs/knowgrph-video-demo.md') || null
  if (!file) throw new Error('expected docs workspace source file to stay present')
  if (String(file.text || '').trim() !== '# hydrated markdown') {
    throw new Error(`expected blank workspace inline text not to clobber existing hydrated source text, got "${String(file.text || '')}"`)
  }
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
        name: 'knowgrph-demo-video.md',
        text: '---\ntitle: Validation\n---\n',
        enabled: false,
        status: 'idle',
        source: { kind: 'local', path: TEST_VALIDATION_SOURCE_PATH },
      },
    ],
    workspaceEntries: [
      {
        kind: 'file',
        path: '/sandbox/test-data/test-generate-video/knowgrph-demo-video.md',
        parentPath: '/sandbox/test-data/test-generate-video',
        name: 'knowgrph-demo-video.md',
        text: '---\ntitle: Validation\nkgCanvas2dRenderer: "flowEditor"\n---\n',
        updatedAtMs: 1,
      },
    ],
    sourcesByPath: {},
    forceIncludePaths: ['/sandbox/test-data/test-generate-video/knowgrph-demo-video.md'],
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
      { kind: 'file', path: WORKSPACE_README_SEED_PATH, parentPath: '/', name: 'knowgrph-maps-readme.md', text: '# Readme', updatedAtMs: 1 },
      {
        kind: 'file',
        path: '/sandbox/test-data/test-generate-video/knowgrph-demo-video.md',
        parentPath: '/sandbox/test-data/test-generate-video',
        name: 'knowgrph-demo-video.md',
        text: '# Demo',
        updatedAtMs: 1,
      },
      {
        kind: 'file',
        path: GEOSPATIAL_WORKSPACE_SEED_PATH,
        parentPath: '/',
        name: 'knowgrph-maps-places.md',
        text: '# Maps',
        updatedAtMs: 1,
      },
    ],
    sourcesByPath: {},
  })

  const readme = next.find(f => f.source?.path === WORKSPACE_README_SOURCE_PATH)
  const demo = next.find(f => f.source?.path === TEST_VALIDATION_SOURCE_PATH)
  const geospatial = next.find(f => f.source?.path === GEOSPATIAL_WORKSPACE_SOURCE_PATH)
  if (!readme) throw new Error('expected canonical README seed to always be mirrored into Source Files')
  if (!demo) throw new Error('expected canonical validation demo seed to always be mirrored into Source Files')
  if (!geospatial) throw new Error('expected canonical geospatial seed to always be mirrored into Source Files')
  if (readme.enabled !== true) throw new Error('expected canonical README seed to stay enabled by default')
  if (demo.enabled !== false) throw new Error('expected canonical validation demo seed to stay disabled by default until explicitly activated')
  if (geospatial.enabled !== false) throw new Error('expected canonical geospatial seed to stay disabled by default until explicitly activated')
}

export async function testWorkspaceSourceFilesSyncSuppressesLegacyRootSeedAliasesWhenDocsMirrorExists() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      { kind: 'file', path: WORKSPACE_README_SEED_PATH, parentPath: '/', name: 'knowgrph-maps-readme.md', text: '# Readme root', updatedAtMs: 1 },
      { kind: 'file', path: GEOSPATIAL_WORKSPACE_SEED_PATH, parentPath: '/', name: 'knowgrph-maps-places.md', text: '# Places root', updatedAtMs: 1 },
      { kind: 'file', path: '/docs/knowgrph-maps-readme.md', parentPath: '/docs', name: 'knowgrph-maps-readme.md', text: '# Readme docs', updatedAtMs: 1 },
      { kind: 'file', path: '/docs/knowgrph-maps-places.md', parentPath: '/docs', name: 'knowgrph-maps-places.md', text: '# Places docs', updatedAtMs: 1 },
    ],
    sourcesByPath: {
      '/docs/knowgrph-maps-readme.md': { kind: 'local', originalName: 'knowgrph-maps-readme.md' },
      '/docs/knowgrph-maps-places.md': { kind: 'local', originalName: 'knowgrph-maps-places.md' },
    },
  })

  const rootReadme = next.find(f => f.source?.path === WORKSPACE_README_SOURCE_PATH)
  if (rootReadme) throw new Error('expected root README seed alias to be suppressed when docs mirror provides canonical file with same basename')
  const rootGeospatial = next.find(f => f.source?.path === GEOSPATIAL_WORKSPACE_SOURCE_PATH)
  if (rootGeospatial) throw new Error('expected root geospatial seed alias to be suppressed when docs mirror provides canonical file with same basename')
  const docsReadme = next.find(f => f.source?.path === 'workspace:/docs/knowgrph-maps-readme.md')
  if (!docsReadme) throw new Error('expected docs mirrored README to stay present as canonical Source Files entry')
  const docsPlaces = next.find(f => f.source?.path === 'workspace:/docs/knowgrph-maps-places.md')
  if (!docsPlaces) throw new Error('expected docs mirrored places markdown to stay present as canonical Source Files entry')
}

export async function testWorkspaceSourceFilesSyncDeduplicatesLegacyAliasFamilyToSingleCanonicalSourcePath() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      {
        kind: 'file',
        path: BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH,
        parentPath: '/sandbox/test-data/test-generate-video',
        name: 'knowgrph-demo-video.md',
        text: '# bundled',
        updatedAtMs: 1,
      },
      {
        kind: 'file',
        path: LEGACY_TEST_VALIDATION_WORKSPACE_SEED_PATH,
        parentPath: '/',
        name: 'knowgrph-video-demo.md',
        text: '# legacy',
        updatedAtMs: 2,
      },
    ],
    sourcesByPath: {},
  })

  const canonicalValidation = next.filter(f => f.source?.path === TEST_VALIDATION_SOURCE_PATH)
  if (canonicalValidation.length !== 1) {
    throw new Error(`expected seed alias family to collapse into one canonical validation source entry, got ${canonicalValidation.length}`)
  }
}

export async function testWorkspaceSourceFilesSyncDocsOnlyModeExcludesNonDocsWorkspaceFiles() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [],
    workspaceEntries: [
      { kind: 'file', path: '/docs/documents/knowgrph-storage-sync-document.md', parentPath: '/docs/documents', name: 'knowgrph-storage-sync-document.md', text: '# docs', updatedAtMs: 1 },
      { kind: 'file', path: '/sandbox/demo/knowgrph-maps-grabmap-multim-demo.md', parentPath: '/sandbox/demo', name: 'knowgrph-maps-grabmap-multim-demo.md', text: '# demo', updatedAtMs: 1 },
    ],
    sourcesByPath: {
      '/docs/documents/knowgrph-storage-sync-document.md': { kind: 'local', originalName: 'knowgrph-storage-sync-document.md' },
      '/sandbox/demo/knowgrph-maps-grabmap-multim-demo.md': { kind: 'local', originalName: 'knowgrph-maps-grabmap-multim-demo.md' },
    },
    workspaceDocsOnly: true,
  })

  const docs = next.find(f => f.source?.path === 'workspace:/docs/documents/knowgrph-storage-sync-document.md')
  if (!docs) throw new Error('expected docs mirror entry to remain in docs-only mode')
  const sandbox = next.find(f => f.source?.path === 'workspace:/sandbox/demo/knowgrph-maps-grabmap-multim-demo.md')
  if (sandbox) throw new Error('expected non-docs workspace entries to be excluded in docs-only mode')
}

export async function testWorkspaceSourceFilesSyncDocsOnlyModeDropsExistingNonWorkspaceEntries() {
  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [
      {
        id: 'legacy-root-readme',
        name: 'knowgrph-maps-readme.md',
        text: '# legacy root',
        enabled: true,
        status: 'idle',
        source: { kind: 'url', url: 'https://example.com/knowgrph-maps-readme.md', path: 'legacy:root:knowgrph-maps-readme.md' },
      },
    ],
    workspaceEntries: [
      { kind: 'file', path: '/docs/knowgrph-storage-sync-cloudflare-d1.md', parentPath: '/docs', name: 'knowgrph-storage-sync-cloudflare-d1.md', text: '# docs', updatedAtMs: 1 },
    ],
    sourcesByPath: {
      '/docs/knowgrph-storage-sync-cloudflare-d1.md': { kind: 'local', originalName: 'knowgrph-storage-sync-cloudflare-d1.md' },
    },
    workspaceDocsOnly: true,
  })

  const legacyRoot = next.find(f => f.id === 'legacy-root-readme')
  if (legacyRoot) throw new Error('expected docs-only mode to remove existing non-workspace/legacy source files')
  const docs = next.find(f => f.source?.path === 'workspace:/docs/knowgrph-storage-sync-cloudflare-d1.md')
  if (!docs) throw new Error('expected docs-only mode to keep docs mirrored source files')
}

export async function testWorkspaceSeedSourceFilesResolveBundledValidationAliasToCanonicalSourcePath() {
  if (resolveWorkspaceSeedSourcePath(BUNDLED_TEST_VALIDATION_WORKSPACE_SEED_PATH) !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected bundled validation workspace seed alias to resolve onto the canonical validation source-file path')
  }
  if (resolveWorkspaceSeedSourcePath(BUNDLED_GEOSPATIAL_WORKSPACE_SEED_PATH) !== GEOSPATIAL_WORKSPACE_SOURCE_PATH) {
    throw new Error('expected bundled geospatial workspace seed alias to resolve onto the canonical geospatial source-file path')
  }
  if (resolveWorkspaceSeedSourcePath(WORKSPACE_README_SEED_PATH) !== WORKSPACE_README_SOURCE_PATH) {
    throw new Error('expected README workspace seed path to resolve onto the canonical README source-file path')
  }
  if (resolveWorkspaceSeedSourcePath(LEGACY_CANONICAL_TEST_VALIDATION_WORKSPACE_SEED_PATH) !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected legacy video demo workspace seed alias to resolve onto the canonical validation source-file path')
  }
  if (resolveWorkspaceSeedSourcePath(LEGACY_CANONICAL_GEOSPATIAL_WORKSPACE_SEED_PATH) !== GEOSPATIAL_WORKSPACE_SOURCE_PATH) {
    throw new Error('expected legacy geospatial workspace seed alias to resolve onto the canonical geospatial source-file path')
  }
  if (resolveWorkspaceSeedSourcePath('/docs/documents/knowgrph-storage-sync-document.md') !== 'workspace:/docs/documents/knowgrph-storage-sync-document.md') {
    throw new Error('expected docs-mirrored workspace paths to resolve into canonical workspace source-file paths')
  }
  if (
    resolveWorkspaceSeedSourcePath(ABSOLUTE_DOCS_VIDEO_DEMO_PATH)
    !== 'workspace:/docs/knowgrph-video-demo.md'
  ) {
    throw new Error('expected absolute docs file paths to resolve into canonical /docs workspace source-file paths')
  }
  if (
    resolveWorkspaceSeedSourcePath('/docs/huijoohwee/docs/knowgrph-video-demo.md')
    !== 'workspace:/docs/knowgrph-video-demo.md'
  ) {
    throw new Error('expected duplicated docs prefix paths to collapse into canonical /docs workspace source-file paths')
  }
  if (resolveWorkspaceSeedSourcePath('/notes/custom.md') !== null) {
    throw new Error('expected non-seed workspace paths to stay outside canonical seed source-file remapping')
  }
}

export async function testWorkspaceSourceFilesSyncResolvesCanonicalSourceKeyForSeedAliases() {
  const docsValidationAliasPath = '/docs/workspace-seeds/knowgrph-video-demo.md'
  const canonicalSeedPath = LEGACY_TEST_VALIDATION_WORKSPACE_SEED_PATH
  const absoluteDocsPath = ABSOLUTE_DOCS_VIDEO_DEMO_PATH
  if (resolveWorkspaceSourcePathKey(docsValidationAliasPath) !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected docs validation alias path to resolve onto canonical validation source-file key')
  }
  if (resolveWorkspaceSourcePathKey(canonicalSeedPath) !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected legacy validation alias path to resolve onto canonical validation source-file key')
  }
  if (resolveWorkspaceSourcePathKey(absoluteDocsPath) !== 'workspace:/docs/knowgrph-video-demo.md') {
    throw new Error('expected absolute docs path to resolve onto canonical docs workspace source-file key')
  }
  if (resolveWorkspaceSourcePathKey('/docs/huijoohwee/docs/knowgrph-video-demo.md') !== 'workspace:/docs/knowgrph-video-demo.md') {
    throw new Error('expected duplicated docs workspace path to resolve onto canonical docs workspace source-file key')
  }
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

  if (next.length !== 3) throw new Error(`expected canonical default source-file family to contain exactly three entries, got ${next.length}`)
  if (next[0]?.source?.path !== WORKSPACE_README_SOURCE_PATH) {
    throw new Error('expected reconciled default source-file family to restore README first')
  }
  if (next[1]?.source?.path !== TEST_VALIDATION_SOURCE_PATH) {
    throw new Error('expected reconciled default source-file family to restore validation demo second')
  }
  if (next[2]?.source?.path !== GEOSPATIAL_WORKSPACE_SOURCE_PATH) {
    throw new Error('expected reconciled default source-file family to restore geospatial demo third')
  }
  if (next[0]?.enabled !== true) throw new Error('expected reconciled README seed source file to stay enabled')
  if (next[1]?.enabled !== false) throw new Error('expected reconciled validation demo seed source file to stay disabled')
  if (next[2]?.enabled !== false) throw new Error('expected reconciled geospatial seed source file to stay disabled')
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
      name: 'knowgrph-demo-video.md',
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
