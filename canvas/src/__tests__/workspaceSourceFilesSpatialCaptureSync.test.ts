import type { WorkspaceEntry } from '@/features/workspace-fs/types'
import { mergeWorkspaceEntriesIntoSourceFiles, resolveWorkspaceSourcePathKey } from '@/features/workspace-fs/syncToSourceFiles'
import type { SourceFile } from '@/hooks/store/types'

export function testWorkspaceSourceFilesSyncDropsStandaloneSpatialCaptureColliderPayload() {
  const manifestPath = '/captures/capture-alpha.spatial-capture.md'
  const colliderPath = '/captures/capture-alpha-collider.glb'
  const existingCollider: SourceFile = {
    id: 'stale-collider',
    name: 'capture-alpha-collider.glb',
    text: [
      '---',
      'kgAssetType: "model"',
      'kgAssetFormat: "glb"',
      'kgAssetPendingLocalImport: true',
      `kgAssetPendingLocalPath: "${colliderPath}"`,
      '---',
      '',
      'Pending local GLB import.',
    ].join('\n'),
    enabled: true,
    status: 'idle',
    source: { kind: 'local', path: resolveWorkspaceSourcePathKey(colliderPath) },
  }
  const workspaceEntries: WorkspaceEntry[] = [
    {
      kind: 'file',
      path: manifestPath,
      parentPath: '/captures',
      name: 'capture-alpha.spatial-capture.md',
      text: [
        '---',
        'kgAssetType: "model"',
        'kgAssetFormat: "glb"',
        'kgAssetPendingLocalImport: true',
        `kgAssetPendingLocalPath: "${colliderPath}"`,
        'kgSpatialCaptureFileset: true',
        'kgCanvas3dMode: "xr"',
        '---',
        '',
        '# capture-alpha spatial capture',
      ].join('\n'),
      updatedAtMs: 1,
    },
    {
      kind: 'file',
      path: colliderPath,
      parentPath: '/captures',
      name: 'capture-alpha-collider.glb',
      text: existingCollider.text,
      updatedAtMs: 1,
    },
  ]

  const next = mergeWorkspaceEntriesIntoSourceFiles({
    existing: [existingCollider],
    workspaceEntries,
    sourcesByPath: {
      [manifestPath]: { kind: 'local', originalName: 'capture-alpha.spatial-capture.md' },
      [colliderPath]: { kind: 'local', originalName: 'capture-alpha-collider.glb' },
    },
    forceIncludePaths: [manifestPath, colliderPath],
    preserveExistingWorkspaceEntries: true,
  })

  const sourcePaths = next.map(file => String(file.source?.path || '')).sort()
  if (!sourcePaths.includes(resolveWorkspaceSourcePathKey(manifestPath))) {
    throw new Error(`expected spatial capture manifest to stay visible, got ${sourcePaths.join(', ')}`)
  }
  if (sourcePaths.includes(resolveWorkspaceSourcePathKey(colliderPath))) {
    throw new Error(`expected standalone spatial collider payload to be hidden, got ${sourcePaths.join(', ')}`)
  }
}
