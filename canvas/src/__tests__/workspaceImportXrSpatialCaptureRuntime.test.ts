import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseStandaloneSpatialCaptureManifest } from '@/features/markdown-workspace/workspaceImport/spatialCaptureFileset'
import { loadSpatialCapturePointCloud, resetSpatialCaptureAssetRuntimeForTests } from '@/lib/assets/spatialCaptureAssetRuntime'
import { parsePlyPointCloud } from '@/lib/assets/plyPointCloud'

function asciiPly(points: string[]): Uint8Array {
  return new TextEncoder().encode([
    'ply',
    'format ascii 1.0',
    `element vertex ${points.length}`,
    'property float x',
    'property float y',
    'property float z',
    'end_header',
    ...points,
    '',
  ].join('\n'))
}

function binaryBigEndianRgbPly(): Uint8Array {
  const header = new TextEncoder().encode([
    'ply',
    'format binary_big_endian 1.0',
    'element vertex 2',
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'end_header',
    '',
  ].join('\n'))
  const rowBytes = 15
  const out = new Uint8Array(header.length + rowBytes * 2)
  out.set(header, 0)
  const view = new DataView(out.buffer)
  let offset = header.length
  for (const point of [
    { xyz: [1, 2, 3] as const, rgb: [255, 32, 0] as const },
    { xyz: [4, 5, 6] as const, rgb: [0, 128, 255] as const },
  ]) {
    view.setFloat32(offset, point.xyz[0], false)
    view.setFloat32(offset + 4, point.xyz[1], false)
    view.setFloat32(offset + 8, point.xyz[2], false)
    out[offset + 12] = point.rgb[0]
    out[offset + 13] = point.rgb[1]
    out[offset + 14] = point.rgb[2]
    offset += rowBytes
  }
  return out
}

function partialGaussianPly(): Uint8Array {
  return new TextEncoder().encode([
    'ply',
    'format ascii 1.0',
    'element vertex 1',
    'property float x',
    'property float y',
    'property float z',
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2',
    'property float scale_0',
    'property float scale_1',
    'end_header',
    '1 2 3 0 0 0 -2 -3',
    '',
  ].join('\n'))
}

function manifestFor(url: string) {
  const text = [
    '---',
    'kgAssetType: "model"',
    'kgAssetFormat: "ply"',
    'kgSpatialCaptureFileset: false',
    'kgSpatialCaptureFormat: "ply"',
    'kgSpatialCaptureSourceKind: "url"',
    `kgSpatialCaptureSourceName: "${url.split('/').pop() || 'scan.ply'}"`,
    `kgSpatialCaptureSourceIdentity: "${url}"`,
    `kgXrIngestionCacheKey: "${url}"`,
    `kgXrRenderCacheKey: "${url}"`,
    'kgCanvas3dMode: "xr"',
    '---',
    '',
  ].join('\n')
  const manifest = parseStandaloneSpatialCaptureManifest(text)
  if (!manifest) throw new Error(`expected manifest for ${url}`)
  return manifest
}

export function testWorkspaceImportXrStandalonePlyParserHandlesEndianSamplingAndPartialGaussianRows() {
  const sampled = parsePlyPointCloud(asciiPly(['0 0 0', '1 0 0', '2 0 0', '3 0 0', '4 0 0', '5 0 0']), 3)
  if (sampled.sourcePointCount !== 6 || sampled.pointCount !== 3) {
    throw new Error(`expected uniform downsample to honor source and budget counts, got ${JSON.stringify({ source: sampled.sourcePointCount, parsed: sampled.pointCount })}`)
  }
  if (sampled.positions[0] !== 0 || sampled.positions[3] !== -3 || sampled.positions[6] !== -5) {
    throw new Error(`expected uniform downsample to preserve first/middle/last geometry, got ${Array.from(sampled.positions).join(',')}`)
  }

  const bigEndian = parsePlyPointCloud(binaryBigEndianRgbPly(), 10)
  if (bigEndian.pointCount !== 2 || bigEndian.positions[0] !== -1 || bigEndian.positions[3] !== -4 || !bigEndian.colors || bigEndian.colors[0] !== 1 || bigEndian.colors[5] !== 1) {
    throw new Error(`expected binary_big_endian RGB PLY to preserve geometry/color, got ${JSON.stringify({ positions: Array.from(bigEndian.positions), colors: bigEndian.colors ? Array.from(bigEndian.colors) : null })}`)
  }

  const partial = parsePlyPointCloud(partialGaussianPly(), 10)
  if (
    partial.kind !== 'gaussian-splat'
    || !partial.opacities
    || !partial.splatScales
    || !partial.splatRotations
    || partial.opacities[0] !== 1
    || partial.splatScales[2] > 0.000002
    || partial.splatRotations.some((value, index) => Math.abs(value - [0, 0, 1, 0][index]!) > 1e-6)
  ) {
    throw new Error(`expected partial Gaussian PLY rows to keep renderable defaults, got ${JSON.stringify({
      kind: partial.kind,
      opacity: partial.opacities ? Array.from(partial.opacities) : null,
      scales: partial.splatScales ? Array.from(partial.splatScales) : null,
      rotations: partial.splatRotations ? Array.from(partial.splatRotations) : null,
    })}`)
  }
}

export async function testWorkspaceImportXrStandalonePlyRuntimeDedupesAndBoundsParsedLoadCache() {
  const originalFetch = globalThis.fetch
  const fetchState = { count: 0 }
  const readFetchCount = () => Number(fetchState.count)
  globalThis.fetch = (async () => {
    fetchState.count += 1
    return new Response(asciiPly(['0 0 0', '1 0 0']), { status: 200, headers: { 'content-type': 'model/ply' } })
  }) as typeof fetch
  try {
    resetSpatialCaptureAssetRuntimeForTests()
    const manifestA = manifestFor('https://assets.example.test/a.ply')
    const manifestB = manifestFor('https://assets.example.test/b.ply')
    const manifestC = manifestFor('https://assets.example.test/c.ply')
    const [firstA, secondA] = await Promise.all([
      loadSpatialCapturePointCloud(manifestA, 10),
      loadSpatialCapturePointCloud(manifestA, 10),
    ])
    if (!firstA || firstA !== secondA || readFetchCount() !== 1) {
      throw new Error(`expected concurrent PLY loads to share one parsed task, got ${JSON.stringify({ same: firstA === secondA, fetchCount: readFetchCount() })}`)
    }
    await loadSpatialCapturePointCloud(manifestA, 10)
    if (readFetchCount() !== 1) throw new Error(`expected cached PLY reload to avoid refetch, got ${readFetchCount()}`)
    await loadSpatialCapturePointCloud(manifestB, 10)
    await loadSpatialCapturePointCloud(manifestC, 10)
    await loadSpatialCapturePointCloud(manifestA, 10)
    if (readFetchCount() !== 4) throw new Error(`expected parsed-load cache to prune old entries after the memory-bounded budget, got ${readFetchCount()}`)
  } finally {
    globalThis.fetch = originalFetch
    resetSpatialCaptureAssetRuntimeForTests()
  }
}

export function testWorkspaceImportXrStandalonePlyRuntimeUsesTransferBackedWorkerParser() {
  const runtime = readFileSync(resolve(process.cwd(), 'src', 'lib', 'assets', 'spatialCaptureAssetRuntime.ts'), 'utf8')
  const worker = readFileSync(resolve(process.cwd(), 'src', 'lib', 'assets', 'plyPointCloudWorker.ts'), 'utf8')
  const requiredRuntimeMarkers = [
    "new Worker(new URL('./plyPointCloudWorker.ts', import.meta.url)",
    "type: 'module'",
    "name: 'kg-ply-point-cloud-parser'",
    'worker.postMessage({ requestId, buffer, maxPoints }, [buffer])',
    'const byteLength = buffer.byteLength',
    'await parseSpatialCapturePointCloud(buffer, maxPoints)',
    'SPATIAL_CAPTURE_PARSE_WORKER_TIMEOUT_MS',
  ]
  const missingRuntime = requiredRuntimeMarkers.filter(marker => !runtime.includes(marker))
  if (missingRuntime.length) {
    throw new Error(`expected spatial capture runtime to use a bounded transferable PLY parser worker, missing ${missingRuntime.join(', ')}`)
  }
  const requiredWorkerMarkers = [
    "import { parsePlyPointCloud, type PlyPointCloud } from './plyPointCloud'",
    'collectPointCloudTransfers(pointCloud)',
    'pointCloud.positions.buffer',
    'pointCloud.colors?.buffer',
    'pointCloud.opacities?.buffer',
    'pointCloud.splatScales?.buffer',
    'pointCloud.splatRotations?.buffer',
    'postMessage(message, transfers)',
  ]
  const missingWorker = requiredWorkerMarkers.filter(marker => !worker.includes(marker))
  if (missingWorker.length) {
    throw new Error(`expected PLY parser worker to transfer parsed typed-array ownership, missing ${missingWorker.join(', ')}`)
  }
}
