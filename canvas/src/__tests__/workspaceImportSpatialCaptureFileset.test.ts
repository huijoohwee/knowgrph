import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { importWorkspaceLocalFolder, peekPendingWorkspaceLocalImport } from '@/features/markdown-workspace/workspaceImport'
import { shouldApplyImportedCanvasDocumentToGraph } from '@/features/markdown-workspace/workspaceImport/applyPolicy'
import { GLB_ASSET_MIME_TYPE, parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const createBinaryFile = (name: string, bytes: Uint8Array, type = 'application/octet-stream') => {
  const blob = new Blob([bytes], { type })
  return new File([blob], name, { type })
}

function createMinimalGlbBytes(): Uint8Array {
  const jsonRaw = new TextEncoder().encode(JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
  }))
  const jsonLength = Math.ceil(jsonRaw.byteLength / 4) * 4
  const bytes = new Uint8Array(12 + 8 + jsonLength)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, bytes.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(jsonRaw, 20)
  bytes.fill(0x20, 20 + jsonRaw.byteLength, 20 + jsonLength)
  return bytes
}

function withFolderRelativePath(file: File, relativePath: string): File {
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath, configurable: true })
  return file
}

export async function testWorkspaceImportLocalFolderSpatialCaptureFilesetCreatesRenderableXrManifest() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const files = [
      withFolderRelativePath(createBinaryFile('capture-alpha.ply', new Uint8Array([112, 108, 121, 10])), 'captures/capture-alpha.ply'),
      withFolderRelativePath(createBinaryFile('capture-alpha.spz', new Uint8Array([31, 139, 8, 0]), 'application/gzip'), 'captures/capture-alpha.spz'),
      withFolderRelativePath(createBinaryFile('capture-alpha-panorama.jpg', new Uint8Array([137, 80, 78, 71]), 'image/png'), 'captures/capture-alpha-panorama.jpg'),
      withFolderRelativePath(createBinaryFile('capture-alpha-collider.glb', createMinimalGlbBytes(), GLB_ASSET_MIME_TYPE), 'captures/capture-alpha-collider.glb'),
    ]
    const res = await importWorkspaceLocalFolder({ fs, files })
    const manifestPath = '/captures/capture-alpha.spatial-capture.md'
    const colliderPath = '/captures/capture-alpha-collider.glb'
    if (res.failed.length || res.skipped.length) throw new Error(`expected clean spatial fileset import, got ${JSON.stringify({ failed: res.failed, skipped: res.skipped })}`)
    if (res.createdPaths.join('|') !== manifestPath) throw new Error(`expected manifest-only import, got ${res.createdPaths.join(', ')}`)
    const filePaths = (await fs.listEntries()).filter(entry => entry.kind === 'file').map(entry => entry.path)
    if (filePaths.some(path => path.endsWith('.ply') || path.endsWith('.spz') || path.endsWith('-panorama.jpg') || path.endsWith('-collider.glb'))) {
      throw new Error(`expected fileset members to avoid duplicate workspace files, got ${filePaths.join(', ')}`)
    }
    const manifestText = String((await fs.readFileText(manifestPath)) || '')
    for (const expected of [
      'kgAssetType: "model"',
      'kgAssetFormat: "glb"',
      'kgAssetPendingLocalImport: true',
      `kgAssetPendingLocalPath: "${colliderPath}"`,
      'kgSpatialCaptureFileset: true',
      'kgSpatialCaptureFormat: "ply+spz+panorama+glb-collider"',
      'kgSpatialCaptureCoordinateSystem: "right-handed-y-up"',
      'kgSpatialCaptureMovementPlane: "x/z"',
      'kgCanvas3dMode: "xr"',
      '- point-cloud-ply: capture-alpha.ply',
      '- gaussian-splat-spz: capture-alpha.spz',
      '- panorama-image: capture-alpha-panorama.jpg',
      '- collider-glb: capture-alpha-collider.glb',
    ]) if (!manifestText.includes(expected)) throw new Error(`expected spatial manifest to include ${expected}`)
    const asset = parseGlbAssetDocument(manifestText)
    if (!asset || asset.format !== 'glb' || !asset.pendingLocalImport || asset.pendingLocalImportPath !== colliderPath) {
      throw new Error(`expected spatial capture manifest to parse as a pending GLB asset, got ${JSON.stringify(asset)}`)
    }
    if (!shouldApplyImportedCanvasDocumentToGraph({ path: manifestPath, text: manifestText })) throw new Error('expected spatial capture manifest to activate XR')
    if (peekPendingWorkspaceLocalImport(colliderPath)?.kind !== 'glb') throw new Error('expected pending collider GLB payload')
    if (res.corpusManifest?.sourceUnits.length !== 4) throw new Error(`expected four fileset source units, got ${JSON.stringify(res.corpusManifest)}`)
  } finally {
    restore()
  }
}
