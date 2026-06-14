import type { VideoDownloadParseError, VideoDownloadResult } from './types'

const REQUIRED_OK_FIELDS = ['ok', 'filePath', 'fileName', 'mimeType', 'sizeBytes', 'sourceUrl'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function jsonOffsetFromSyntaxError(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error || '')
  const match = /\bposition\s+(\d+)\b/i.exec(message)
  if (!match) return undefined
  const offset = Number(match[1])
  return Number.isFinite(offset) ? offset : undefined
}

function parseRaw(raw: unknown): unknown | VideoDownloadParseError {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    return {
      kind: 'parse_error',
      reason: error instanceof Error ? error.message : 'invalid_json',
      offset: jsonOffsetFromSyntaxError(error),
    }
  }
}

function validateMimeType(value: unknown): boolean {
  return typeof value === 'string' && /^[^/\s]+\/[^/\s]+$/.test(value.trim())
}

export function printVideoDownloadResult(result: VideoDownloadResult): string {
  return JSON.stringify(result)
}

export function parseVideoDownloadResult(raw: unknown): VideoDownloadResult | VideoDownloadParseError {
  const parsed = parseRaw(raw)
  if (isRecord(parsed) && parsed.kind === 'parse_error') return parsed as VideoDownloadParseError
  if (!isRecord(parsed)) return { kind: 'parse_error', reason: 'expected_object' }

  if (parsed.ok === false) {
    if (typeof parsed.error !== 'string' || !parsed.error.trim()) {
      return { kind: 'parse_error', reason: 'missing_or_invalid_fields', missingFields: ['error'] }
    }
    const errorResult: VideoDownloadResult = {
      ok: false,
      error: parsed.error,
      ...(typeof parsed.errorCode === 'string' && parsed.errorCode.trim() ? { errorCode: parsed.errorCode.trim() } : {}),
    }
    return errorResult
  }

  const missingFields: string[] = []
  if (parsed.ok !== true) missingFields.push('ok')
  if (typeof parsed.filePath !== 'string' || !parsed.filePath.trim()) missingFields.push('filePath')
  if (typeof parsed.fileName !== 'string' || !parsed.fileName.trim()) missingFields.push('fileName')
  if (!validateMimeType(parsed.mimeType)) missingFields.push('mimeType')
  if (!Number.isInteger(parsed.sizeBytes) || Number(parsed.sizeBytes) < 0) missingFields.push('sizeBytes')
  if (typeof parsed.sourceUrl !== 'string' || !parsed.sourceUrl.trim()) missingFields.push('sourceUrl')
  if (missingFields.length > 0) {
    return { kind: 'parse_error', reason: 'missing_or_invalid_fields', missingFields }
  }

  const filePath = String(parsed.filePath)
  const fileName = String(parsed.fileName)
  const mimeType = String(parsed.mimeType)
  const sourceUrl = String(parsed.sourceUrl)
  const fileUrl = typeof parsed.fileUrl === 'string' && parsed.fileUrl.trim() ? parsed.fileUrl.trim() : ''
  return {
    ok: true,
    filePath,
    fileName,
    mimeType,
    sizeBytes: Number(parsed.sizeBytes),
    sourceUrl,
    ...(fileUrl ? { fileUrl } : {}),
  }
}

export function isVideoDownloadParseError(value: unknown): value is VideoDownloadParseError {
  return isRecord(value) && value.kind === 'parse_error'
}
