import { buildPlyPointCloudPreviewBuffer, readPlyPointCloudBinaryLayout, type PlyPointCloudBinaryLayout } from './plyPointCloud'

export type SpatialCapturePreviewSource = 'pending-local' | 'browser-cache' | 'local-source' | 'url'

export type SpatialCapturePreviewFetchTarget = {
  path: string
  source: SpatialCapturePreviewSource
}

export type SpatialCapturePreviewBufferLoad = {
  buffer: ArrayBuffer
  byteLength: number
  source: SpatialCapturePreviewSource
  sourcePointCount: number
}

const SPATIAL_CAPTURE_PREVIEW_HEADER_BYTES = 131_072
const SPATIAL_CAPTURE_PREVIEW_RANGE_CHUNKS = 8

function toUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer)
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
}

function readContentRangeTotal(headers: Headers): number {
  const raw = String(headers.get('content-range') || '').trim()
  const total = Number(raw.match(/\/(\d+)\s*$/)?.[1] || 0)
  return Number.isFinite(total) && total > 0 ? total : 0
}

function readBinaryLayoutOrNull(buffer: ArrayBuffer): PlyPointCloudBinaryLayout | null {
  try {
    return readPlyPointCloudBinaryLayout(buffer)
  } catch {
    return null
  }
}

function buildPreviewRowRanges(layout: PlyPointCloudBinaryLayout, maxPoints: number): Array<{ startRow: number; rowCount: number }> {
  const totalRows = Math.max(0, Math.floor(layout.sourcePointCount))
  const previewRows = Math.min(totalRows, Math.max(1, Math.floor(maxPoints)))
  if (previewRows >= totalRows) return [{ startRow: 0, rowCount: totalRows }]
  const chunkCount = Math.min(SPATIAL_CAPTURE_PREVIEW_RANGE_CHUNKS, previewRows)
  const ranges: Array<{ startRow: number; rowCount: number }> = []
  let remainingRows = previewRows
  for (let index = 0; index < chunkCount; index += 1) {
    const remainingChunks = chunkCount - index
    const rowCount = Math.ceil(remainingRows / remainingChunks)
    const maxStartRow = Math.max(0, totalRows - rowCount)
    const startRow = chunkCount === 1 ? 0 : Math.floor((maxStartRow * index) / (chunkCount - 1))
    const previous = ranges[ranges.length - 1]
    if (previous && previous.startRow + previous.rowCount >= startRow) {
      const nextEnd = Math.max(previous.startRow + previous.rowCount, startRow + rowCount)
      previous.rowCount = nextEnd - previous.startRow
    } else {
      ranges.push({ startRow, rowCount })
    }
    remainingRows -= rowCount
  }
  return ranges
}

function buildRangePreviewFromLayout(args: {
  byteLength: number
  layout: PlyPointCloudBinaryLayout
  rowChunks: Uint8Array[]
  source: SpatialCapturePreviewSource
}): SpatialCapturePreviewBufferLoad | null {
  const previewBytes = buildPlyPointCloudPreviewBuffer({
    headerBytes: args.layout.headerBytes,
    rowBytes: args.layout.rowBytes,
    rowChunks: args.rowChunks,
  })
  if (!previewBytes) return null
  return {
    buffer: toOwnedArrayBuffer(previewBytes),
    byteLength: args.byteLength,
    source: args.source,
    sourcePointCount: args.layout.sourcePointCount,
  }
}

export async function readFileRangePreviewBuffer(file: File, source: SpatialCapturePreviewSource, maxPoints: number): Promise<SpatialCapturePreviewBufferLoad | null> {
  const headerBuffer = await file.slice(0, Math.min(file.size, SPATIAL_CAPTURE_PREVIEW_HEADER_BYTES)).arrayBuffer()
  const layout = readBinaryLayoutOrNull(headerBuffer)
  if (!layout) return null
  const rowChunks = await Promise.all(buildPreviewRowRanges(layout, maxPoints).map(range => {
    const start = layout.bodyOffset + range.startRow * layout.rowBytes
    const end = Math.min(file.size, start + range.rowCount * layout.rowBytes)
    return file.slice(start, end).arrayBuffer().then(buffer => toUint8Array(buffer))
  }))
  return buildRangePreviewFromLayout({ byteLength: file.size, layout, rowChunks, source })
}

async function fetchByteRange(path: string, start: number, endInclusive: number): Promise<{ buffer: ArrayBuffer; rangeSupported: boolean; totalBytes: number }> {
  const response = await fetch(path, {
    headers: {
      Accept: 'model/ply,application/octet-stream,*/*',
      Range: `bytes=${Math.max(0, Math.floor(start))}-${Math.max(0, Math.floor(endInclusive))}`,
    },
  })
  if (!response.ok) throw new Error(`PLY source range fetch failed (${response.status})`)
  return {
    buffer: await response.arrayBuffer(),
    rangeSupported: response.status === 206,
    totalBytes: readContentRangeTotal(response.headers),
  }
}

export async function readFetchTargetRangePreviewBuffer(target: SpatialCapturePreviewFetchTarget, maxPoints: number): Promise<SpatialCapturePreviewBufferLoad | null> {
  const header = await fetchByteRange(target.path, 0, SPATIAL_CAPTURE_PREVIEW_HEADER_BYTES - 1)
  if (!header.rangeSupported) {
    return {
      buffer: header.buffer,
      byteLength: header.totalBytes || header.buffer.byteLength,
      source: target.source,
      sourcePointCount: 0,
    }
  }
  const layout = readBinaryLayoutOrNull(header.buffer)
  if (!layout) return null
  const rowChunks: Uint8Array[] = []
  for (const range of buildPreviewRowRanges(layout, maxPoints)) {
    const start = layout.bodyOffset + range.startRow * layout.rowBytes
    const end = start + range.rowCount * layout.rowBytes - 1
    const rowRange = await fetchByteRange(target.path, start, end)
    if (!rowRange.rangeSupported) return null
    rowChunks.push(toUint8Array(rowRange.buffer))
  }
  return buildRangePreviewFromLayout({
    byteLength: header.totalBytes || layout.bodyOffset + layout.sourcePointCount * layout.rowBytes,
    layout,
    rowChunks,
    source: target.source,
  })
}
