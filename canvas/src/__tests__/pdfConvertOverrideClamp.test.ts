import type { IncomingMessage } from 'node:http'
import { PassThrough } from 'node:stream'
import { parsePdfConvertRequest } from '@/lib/pdf/server/pdfConvertRequest'

function mockReq(url: string): IncomingMessage {
  const s = new PassThrough() as unknown as IncomingMessage
  ;(s as unknown as { url?: string }).url = url
  ;(s as unknown as { headers: Record<string, string> }).headers = { host: 'localhost' }
  return s
}

export async function testPdfConvertQueryParsesOptionalLimitOverrides() {
  const req = mockReq(
    '/__convert_pdf?maxPdfBytes=123&fetchTimeoutMs=456&uploadTimeoutMs=789&convertTimeoutMs=1011&streamDecodeCacheMaxBytes=2022&contentStreamMaxDecodeBytes=3033&pageContentMaxBytes=4044&cmapMaxBytes=5055&maxToUnicodeStreamBytes=6066&toUnicodeMaxDecodeBytes=7077&imageStreamMaxDecodeBytes=8088&maxTextContentBytesPerPage=9099&maxTextStreamBytes=10010&maxFormXObjectBytes=11111&maxFormXObjectStreamBytes=12121&maxFormXObjectCount=0',
  )
  const parsed = parsePdfConvertRequest({ req })
  if (parsed.overrides.maxPdfBytes !== 123) throw new Error('expected maxPdfBytes parsed')
  if (parsed.overrides.fetchTimeoutMs !== 456) throw new Error('expected fetchTimeoutMs parsed')
  if (parsed.overrides.uploadTimeoutMs !== 789) throw new Error('expected uploadTimeoutMs parsed')
  if (parsed.overrides.convertTimeoutMs !== 1011) throw new Error('expected convertTimeoutMs parsed')
  if (parsed.overrides.streamDecodeCacheMaxBytes !== 2022) throw new Error('expected streamDecodeCacheMaxBytes parsed')
  if (parsed.overrides.contentStreamMaxDecodeBytes !== 3033) throw new Error('expected contentStreamMaxDecodeBytes parsed')
  if (parsed.overrides.pageContentMaxBytes !== 4044) throw new Error('expected pageContentMaxBytes parsed')
  if (parsed.overrides.cmapMaxBytes !== 5055) throw new Error('expected cmapMaxBytes parsed')
  if (parsed.overrides.maxToUnicodeStreamBytes !== 6066) throw new Error('expected maxToUnicodeStreamBytes parsed')
  if (parsed.overrides.toUnicodeMaxDecodeBytes !== 7077) throw new Error('expected toUnicodeMaxDecodeBytes parsed')
  if (parsed.overrides.imageStreamMaxDecodeBytes !== 8088) throw new Error('expected imageStreamMaxDecodeBytes parsed')
  if (parsed.overrides.maxTextContentBytesPerPage !== 9099) throw new Error('expected maxTextContentBytesPerPage parsed')
  if (parsed.overrides.maxTextStreamBytes !== 10010) throw new Error('expected maxTextStreamBytes parsed')
  if (parsed.overrides.maxFormXObjectBytes !== 11111) throw new Error('expected maxFormXObjectBytes parsed')
  if (parsed.overrides.maxFormXObjectStreamBytes !== 12121) throw new Error('expected maxFormXObjectStreamBytes parsed')
  if (parsed.overrides.maxFormXObjectCount !== 0) throw new Error('expected maxFormXObjectCount parsed')
}
