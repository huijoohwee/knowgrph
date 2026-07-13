export const parseErrorBody = async (res: Response): Promise<string> => {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  try {
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as {
        error?: { message?: unknown } | string
        message?: unknown
      }
      if (data && typeof data.error === 'object' && data.error && typeof data.error.message === 'string') {
        return data.error.message.trim()
      }
      if (typeof data?.error === 'string') return data.error.trim()
      if (typeof data?.message === 'string') return data.message.trim()
      return ''
    }
    const text = await res.text()
    return String(text || '').trim()
  } catch {
    return ''
  }
}

export const parseJsonResponseBody = async (res: Response, context: string): Promise<unknown> => {
  const label = String(context || '').trim() || 'Provider request'
  let text = ''
  try {
    text = String(await res.text() || '').trim()
  } catch {
    throw new Error(`${label} returned a truncated response body (HTTP ${res.status}). The request was not retried automatically because it may have reached the provider.`)
  }
  if (!text) {
    throw new Error(`${label} returned an empty JSON response (HTTP ${res.status}). The request was not retried automatically because it may have reached the provider.`)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(`${label} returned malformed JSON (HTTP ${res.status}). The request was not retried automatically because it may have reached the provider.`)
  }
}

export const shouldRetryWithModelFallback = (status: number, detail: string): boolean => {
  if (status !== 400 && status !== 404) return false
  const lowered = String(detail || '').toLowerCase()
  if (!lowered) return false
  if (!lowered.includes('model')) return false
  if (lowered.includes('not found')) return true
  if (lowered.includes('does not exist')) return true
  if (lowered.includes('unknown')) return true
  if (lowered.includes('invalid')) return true
  if (lowered.includes('load')) return true
  return false
}

export const shouldRetryWithActivationFallback = (status: number, detail: string): boolean => {
  if (status !== 400 && status !== 403 && status !== 404) return false
  const lowered = String(detail || '').toLowerCase()
  if (!lowered) return false
  if (!lowered.includes('model')) return false
  if (lowered.includes('has not activated')) return true
  if (lowered.includes('activate the model service')) return true
  if (lowered.includes('no permission')) return true
  if (lowered.includes('no access')) return true
  if (lowered.includes('do not have access')) return true
  if (lowered.includes('not support current account')) return true
  return false
}

export const loadAvailableModelIds = async (
  endpoint: string,
  headers?: HeadersInit,
): Promise<string[]> => {
  const res = await fetch(endpoint, {
    method: 'GET',
    headers,
  })
  if (!res.ok) return []
  const data = (await parseJsonResponseBody(res, 'Model catalog request')) as { data?: unknown }
  const list = Array.isArray(data?.data) ? data.data : []
  const ids = list
    .map(entry => {
      if (!entry || typeof entry !== 'object') return ''
      const id = (entry as { id?: unknown }).id
      return typeof id === 'string' ? id.trim() : ''
    })
    .filter(Boolean)
  if (!ids.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  ids.forEach(id => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  })
  return out
}
