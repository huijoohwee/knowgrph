import zlib from 'node:zlib'
import type { NativePdfAsset } from './types'
import type { ParsedIndirectObject, PdfDict, PdfRef } from './pdfObjects'
import { deref, getDictValue, isArray, isDict, isName, isNumber, isRef, readStream, sanitizeFilename } from './pdfObjects'

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length >>> 0, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0)
  return Buffer.concat([len, t, data, crc])
}

function encodePng(args: { width: number; height: number; channels: number; bytes: Buffer }): Buffer {
  const w = Math.max(1, Math.floor(args.width))
  const h = Math.max(1, Math.floor(args.height))
  const channels = args.channels === 1 || args.channels === 3 ? args.channels : 3
  const colorType = channels === 1 ? 0 : 2
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w >>> 0, 0)
  ihdr.writeUInt32BE(h >>> 0, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowBytes = w * channels
  const scanlines = Buffer.alloc((rowBytes + 1) * h)
  for (let y = 0; y < h; y += 1) {
    const dstOff = y * (rowBytes + 1)
    scanlines[dstOff] = 0
    args.bytes.copy(scanlines, dstOff + 1, y * rowBytes, y * rowBytes + rowBytes)
  }
  const idatData = zlib.deflateSync(scanlines, { level: 6 })
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idatData), pngChunk('IEND', Buffer.alloc(0))])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function applyPngPredictor(args: { data: Buffer; width: number; height: number; channels: number }): Buffer | null {
  const rowLen = args.width * args.channels
  const expected = (rowLen + 1) * args.height
  if (args.data.length < expected) return null
  const out = Buffer.alloc(rowLen * args.height)
  for (let y = 0; y < args.height; y += 1) {
    const filter = args.data[y * (rowLen + 1)]
    const row = args.data.subarray(y * (rowLen + 1) + 1, y * (rowLen + 1) + 1 + rowLen)
    const prev = y === 0 ? null : out.subarray((y - 1) * rowLen, (y - 1) * rowLen + rowLen)
    const dst = out.subarray(y * rowLen, y * rowLen + rowLen)
    for (let x = 0; x < rowLen; x += 1) {
      const left = x >= args.channels ? dst[x - args.channels] : 0
      const up = prev ? prev[x] : 0
      const upLeft = prev && x >= args.channels ? prev[x - args.channels] : 0
      const raw = row[x]
      if (filter === 0) dst[x] = raw
      else if (filter === 1) dst[x] = (raw + left) & 0xff
      else if (filter === 2) dst[x] = (raw + up) & 0xff
      else if (filter === 3) dst[x] = (raw + Math.floor((left + up) / 2)) & 0xff
      else if (filter === 4) dst[x] = (raw + paeth(left, up, upLeft)) & 0xff
      else dst[x] = raw
    }
  }
  return out
}

function coerceColorSpaceToChannels(v: unknown): number {
  if (v && typeof v === 'object' && 'kind' in (v as any) && (v as any).kind === 'name') {
    const n = String((v as any).name || '')
    if (n === 'DeviceGray') return 1
    if (n === 'DeviceRGB') return 3
    if (n === 'DeviceCMYK') return 4
  }
  if (v && typeof v === 'object' && 'kind' in (v as any) && (v as any).kind === 'array') {
    const items = (v as any).items as unknown[]
    const first = items && items[0]
    if (first && typeof first === 'object' && 'kind' in (first as any) && (first as any).kind === 'name') {
      const n = String((first as any).name || '')
      if (n === 'ICCBased') return 3
      if (n === 'Indexed') return 3
    }
  }
  return 3
}

function extractImageAsset(args: {
  objects: Map<number, ParsedIndirectObject>
  ref: PdfRef
  pageIndex: number
  key: string
}): NativePdfAsset | null {
  const obj = args.objects.get(args.ref.obj)
  const dict = obj?.dict || null
  if (!dict) return null
  const subtype = getDictValue(dict, 'Subtype')
  if (!isName(subtype) || subtype.name !== 'Image') return null

  const widthVal = getDictValue(dict, 'Width')
  const heightVal = getDictValue(dict, 'Height')
  const bpcVal = getDictValue(dict, 'BitsPerComponent')
  const width = isNumber(widthVal) ? Math.floor(widthVal.value) : 0
  const height = isNumber(heightVal) ? Math.floor(heightVal.value) : 0
  const bpc = isNumber(bpcVal) ? Math.floor(bpcVal.value) : 8
  if (!width || !height || width > 20_000 || height > 20_000) return null
  if (bpc !== 8) return null

  const filterVal = getDictValue(dict, 'Filter')
  const filter = isName(filterVal) ? filterVal.name : isArray(filterVal) ? (filterVal.items.find(isName)?.name || '') : ''
  const safeKey = sanitizeFilename(args.key)
  if (filter === 'DCTDecode') {
    const streamBytes = obj?.stream || null
    if (!streamBytes || streamBytes.length < 1024) return null
    return {
      filename: `page-${String(args.pageIndex + 1).padStart(4, '0')}-${safeKey}.jpg`,
      bytes: streamBytes,
      contentType: 'image/jpeg',
    }
  }

  if (filter !== 'FlateDecode') return null
  const st = readStream(args.objects, args.ref)
  const decoded = st.bytes
  if (!decoded || decoded.length < 32) return null

  const colorspaceVal = getDictValue(dict, 'ColorSpace')
  const channels = coerceColorSpaceToChannels(deref(args.objects, colorspaceVal))
  if (channels !== 1 && channels !== 3 && channels !== 4) return null

  const decodeParmsVal = getDictValue(dict, 'DecodeParms')
  const dp = (() => {
    const v = deref(args.objects, decodeParmsVal)
    return isDict(v) ? v : null
  })()
  const predictor = (() => {
    const p = dp ? getDictValue(dp, 'Predictor') : null
    return isNumber(p) ? Math.floor(p.value) : 1
  })()
  const columns = (() => {
    const c = dp ? getDictValue(dp, 'Columns') : null
    return isNumber(c) ? Math.floor(c.value) : width
  })()
  const colors = (() => {
    const c = dp ? getDictValue(dp, 'Colors') : null
    return isNumber(c) ? Math.floor(c.value) : channels
  })()
  const effChannels = colors === 1 || colors === 3 || colors === 4 ? colors : channels

  const pixelBytes = (() => {
    if (predictor >= 10 && predictor <= 15) {
      return applyPngPredictor({ data: decoded, width: columns || width, height, channels: effChannels })
    }
    return decoded
  })()
  if (!pixelBytes) return null

  const rgbBytes = (() => {
    if (effChannels === 1) return pixelBytes
    if (effChannels === 3) return pixelBytes
    if (effChannels === 4) {
      const out = Buffer.alloc(width * height * 3)
      for (let i = 0, j = 0; i + 3 < pixelBytes.length && j + 2 < out.length; i += 4, j += 3) {
        const c = pixelBytes[i] / 255
        const m = pixelBytes[i + 1] / 255
        const y = pixelBytes[i + 2] / 255
        const k = pixelBytes[i + 3] / 255
        out[j] = Math.round(255 * (1 - Math.min(1, c * (1 - k) + k)))
        out[j + 1] = Math.round(255 * (1 - Math.min(1, m * (1 - k) + k)))
        out[j + 2] = Math.round(255 * (1 - Math.min(1, y * (1 - k) + k)))
      }
      return out
    }
    return pixelBytes
  })()

  const png = encodePng({ width, height, channels: effChannels === 1 ? 1 : 3, bytes: rgbBytes })
  return {
    filename: `page-${String(args.pageIndex + 1).padStart(4, '0')}-${safeKey}.png`,
    bytes: png,
    contentType: 'image/png',
  }
}

export function extractPageImages(args: {
  objects: Map<number, ParsedIndirectObject>
  resources: PdfDict | null
  pageIndex: number
  limit?: number
}): NativePdfAsset[] {
  const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 12
  const out: NativePdfAsset[] = []
  if (!args.resources) return out
  const xobjVal = getDictValue(args.resources, 'XObject')
  const xobjDict = (() => {
    const v = deref(args.objects, xobjVal)
    return isDict(v) ? v : null
  })()
  if (!xobjDict) return out
  for (const [key, val] of Object.entries(xobjDict.map)) {
    if (out.length >= limit) break
    const ref = isRef(val) ? val : null
    if (!ref) continue
    const asset = extractImageAsset({ objects: args.objects, ref, pageIndex: args.pageIndex, key })
    if (!asset) continue
    out.push(asset)
  }
  return out
}

