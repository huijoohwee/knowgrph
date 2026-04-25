import type { SourceFile } from '@/hooks/store/types'
import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { mergeWorkspaceEntriesIntoSourceFiles } from '@/features/workspace-fs/syncToSourceFiles'

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
