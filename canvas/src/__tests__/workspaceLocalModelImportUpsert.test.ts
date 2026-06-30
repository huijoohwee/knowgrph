import { importWorkspaceLocalFiles } from '@/features/markdown-workspace/workspaceImport'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { GLB_ASSET_MIME_TYPE } from '@/lib/assets/glbAssetDocument'
import { readPendingGlbAssetPayload } from '@/lib/assets/glbAssetRuntime'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

function createLargeGlbBytes(binLength: number): Uint8Array {
  const binaryLength = Math.max(128_000, Math.ceil(binLength / 4) * 4)
  const jsonRaw = new TextEncoder().encode(JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    buffers: [{ byteLength: binaryLength }],
  }))
  const jsonLength = Math.ceil(jsonRaw.byteLength / 4) * 4
  const bytes = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, bytes.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(jsonRaw, 20)
  bytes.fill(0x20, 20 + jsonRaw.byteLength, 20 + jsonLength)
  const binHeader = 20 + jsonLength
  view.setUint32(binHeader, binaryLength, true)
  view.setUint32(binHeader + 4, 0x004e4942, true)
  return bytes
}

function createGlbFile(name: string, binLength: number): File {
  const bytes = createLargeGlbBytes(binLength)
  return new File([new Blob([bytes], { type: GLB_ASSET_MIME_TYPE })], name, { type: GLB_ASSET_MIME_TYPE })
}

export async function testWorkspaceLocalModelImportUpsertsSameNamePendingPayload() {
  const { restore } = initJsdomHarness()
  try {
    const fs = createMemoryWorkspaceFs()
    await fs.ensureSeed()
    const first = createGlbFile('capture-collider.glb', 132_000)
    const second = createGlbFile('capture-collider.glb', 148_000)

    await importWorkspaceLocalFiles({ fs, files: [first] })
    const result = await importWorkspaceLocalFiles({ fs, files: [second] })
    const entries = await fs.listEntries()
    const colliderEntries = entries.filter(entry => entry.kind === 'file' && entry.name === 'capture-collider.glb')
    if (result.createdPaths.join('|') !== '/capture-collider.glb') throw new Error(`expected canonical upsert path, got ${result.createdPaths.join(', ')}`)
    if (colliderEntries.length !== 1) throw new Error(`expected one canonical collider file, got ${colliderEntries.map(entry => entry.path).join(', ')}`)

    const text = String((await fs.readFileText('/capture-collider.glb')) || '')
    const pending = await readPendingGlbAssetPayload('/capture-collider.glb')
    if (!text.includes(`kgAssetBytes: ${second.size}`)) throw new Error('expected second import to replace stale model document bytes')
    if (!pending || pending.byteLength !== second.size) throw new Error(`expected pending payload to use second import bytes, got ${pending?.byteLength}`)
  } finally {
    restore()
  }
}
