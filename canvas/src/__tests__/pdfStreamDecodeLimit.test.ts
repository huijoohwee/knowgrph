import zlib from 'node:zlib'
import { readStream } from '@/lib/pdf/native/pdfObjects'
import type { ParsedIndirectObject } from '@/lib/pdf/native/pdfObjects'

export async function testPdfReadStreamRespectsMaxDecodeBytes() {
  const prev = process.env.KNOWGRPH_PDF_STREAM_MAX_DECODE_BYTES
  process.env.KNOWGRPH_PDF_STREAM_MAX_DECODE_BYTES = '1024'
  try {
    const decoded = Buffer.alloc(256 * 1024, 0x61)
    const compressed = zlib.deflateSync(decoded)
    const objects = new Map<number, ParsedIndirectObject>()
    objects.set(1, {
      obj: 1,
      gen: 0,
      dict: { kind: 'dict', map: { Filter: { kind: 'name', name: 'FlateDecode' } } },
      stream: compressed,
      rawStart: 0,
      rawEnd: 0,
    })
    const out = readStream(objects, { obj: 1, gen: 0 }, null)
    if (!out.bytes) throw new Error('expected stream bytes')
    if (out.bytes.length !== compressed.length) throw new Error('expected decode to be bounded and fall back to raw bytes')
  } finally {
    if (prev == null) delete process.env.KNOWGRPH_PDF_STREAM_MAX_DECODE_BYTES
    else process.env.KNOWGRPH_PDF_STREAM_MAX_DECODE_BYTES = prev
  }
}

