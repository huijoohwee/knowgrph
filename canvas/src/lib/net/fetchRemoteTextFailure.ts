import type { FetchRemoteTextFailure } from 'grph-shared/net/fetchRemoteText'

export function describeFetchRemoteTextFailure(res: FetchRemoteTextFailure): string {
  if (res.kind === 'timeout') return 'Timeout'
  if (res.kind === 'too_large') {
    const cl = typeof res.contentLength === 'number' && Number.isFinite(res.contentLength) ? res.contentLength : null
    if (cl != null) {
      const mb = (cl / (1024 * 1024)).toFixed(1)
      return `Too large (${mb} MB)`
    }
    return 'Too large'
  }
  if (res.kind === 'http') return `HTTP ${res.status || 400}`
  return 'Request failed'
}

