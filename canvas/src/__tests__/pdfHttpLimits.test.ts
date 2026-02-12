import http from 'node:http'
import { PassThrough } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { fetchBytesWithLimits, readRequestBodyBytes } from '@/lib/pdf/server/pdfHttp'

export async function testPdfHttpFetchBytesRespectsMaxBytes() {
  const server = http.createServer((req, res) => {
    if (req.url === '/large') {
      const buf = Buffer.alloc(2048, 0x61)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', String(buf.length))
      res.end(buf)
      return
    }
    res.statusCode = 404
    res.end('not found')
  })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  try {
    let threw = false
    try {
      await fetchBytesWithLimits({ url: `http://127.0.0.1:${port}/large`, maxBytes: 1024, timeoutMs: 5_000 })
    } catch {
      threw = true
    }
    if (!threw) throw new Error('expected fetchBytesWithLimits to reject for oversized responses')
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

export async function testPdfHttpReadRequestBodyRespectsMaxBytes() {
  const stream = new PassThrough()
  const p = readRequestBodyBytes({ req: stream as unknown as IncomingMessage, maxBytes: 1024, timeoutMs: 5_000 })
  stream.write(Buffer.alloc(600, 0x61))
  stream.write(Buffer.alloc(600, 0x62))
  stream.end()
  let threw = false
  try {
    await p
  } catch {
    threw = true
  }
  if (!threw) throw new Error('expected readRequestBodyBytes to reject for oversized bodies')
}
