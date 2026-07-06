import { parseGlbAssetDocument } from '@/lib/assets/glbAssetDocument'
import { setPendingGlbAsset } from '@/lib/assets/glbAssetRuntime'
import { loadModelAssetRenderPayload, resetModelAssetRenderPayloadCacheForTests } from '@/lib/assets/modelAssetPayload'

class CountingFile extends File {
  reads = 0
  async arrayBuffer(): Promise<ArrayBuffer> {
    this.reads += 1
    return super.arrayBuffer()
  }
}

function createTinyGlbBytes(): Uint8Array {
  const json = new TextEncoder().encode('{"asset":{"version":"2.0"}}')
  const jsonPadded = new Uint8Array(Math.ceil(json.length / 4) * 4)
  jsonPadded.fill(0x20)
  jsonPadded.set(json)
  const out = new Uint8Array(12 + 8 + jsonPadded.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, out.byteLength, true)
  view.setUint32(12, jsonPadded.length, true)
  view.setUint32(16, 0x4e4f534a, true)
  out.set(jsonPadded, 20)
  return out
}

export async function testModelAssetRenderPayloadCachesPendingLocalGlbReads() {
  resetModelAssetRenderPayloadCacheForTests()
  const file = new CountingFile([createTinyGlbBytes()], 'scan.glb', { type: 'model/gltf-binary' })
  setPendingGlbAsset('/scan.md', file, 'scan.glb', 'glb')
  const doc = parseGlbAssetDocument([
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "glb"',
    'kgAssetName: "scan.glb"',
    'kgAssetPendingLocalImport: true',
    'kgAssetPendingLocalPath: "/scan.md"',
    'kgCanvas3dMode: "xr"',
    '---',
    '',
  ].join('\n'))
  if (!doc) throw new Error('expected pending GLB document')
  const first = await loadModelAssetRenderPayload(doc)
  const second = await loadModelAssetRenderPayload(doc)
  if (first !== second) throw new Error('expected repeated pending GLB loads to reuse cached payload')
  if (file.reads !== 1) throw new Error(`expected one GLB file read, got ${file.reads}`)
  if (!(first.loaderInput instanceof ArrayBuffer)) throw new Error('expected pending GLB loader input to stay binary')
  resetModelAssetRenderPayloadCacheForTests()
}
