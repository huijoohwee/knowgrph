export type SpatialCaptureHeadHints = {
  contentType: string
  filename: string
}

const SPATIAL_CAPTURE_HEAD_TIMEOUT_MS = 3500

function readHeaderValue(headers: Headers, name: string): string {
  return String(headers.get(name) || '').trim()
}

function readContentDispositionFilename(value: unknown): string {
  const raw = String(value || '')
  const encoded = raw.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded).split('/').filter(Boolean).pop() || ''
    } catch {
      return encoded.split('/').filter(Boolean).pop() || ''
    }
  }
  return raw.match(/filename="?([^";]+)"?/i)?.[1]?.trim() || ''
}

function readUrlFilename(value: string): string {
  try {
    const parsed = new URL(value)
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
  } catch {
    return String(value || '').split(/[?#]/)[0]?.split('/').filter(Boolean).pop() || ''
  }
}

export async function fetchSpatialCaptureHeadHints(url: string, fetchPath: string): Promise<SpatialCaptureHeadHints | null> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), SPATIAL_CAPTURE_HEAD_TIMEOUT_MS) : null
  try {
    const response = await fetch(fetchPath, {
      method: 'HEAD',
      headers: { Accept: 'model/ply,model/spz,application/ply,application/spz,application/octet-stream,*/*' },
      ...(ctrl ? { signal: ctrl.signal } : {}),
    })
    if (!response.ok) return null
    return {
      contentType: readHeaderValue(response.headers, 'content-type'),
      filename: readContentDispositionFilename(readHeaderValue(response.headers, 'content-disposition')) || readUrlFilename(url),
    }
  } catch {
    return null
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
