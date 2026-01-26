export type LocalGeoUploadOk = { ok: true; url: string; name: string }
export type LocalGeoUploadErr = { ok: false; error: string; status?: number }
export type LocalGeoUploadResult = LocalGeoUploadOk | LocalGeoUploadErr

export const LOCAL_GEO_UPLOAD_ENDPOINT = '/__geo_upload' as const

export async function uploadGeoJsonTextToLocalStore(args: {
  name: string
  text: string
  endpoint?: string
}): Promise<LocalGeoUploadResult> {
  const endpoint = String(args.endpoint || LOCAL_GEO_UPLOAD_ENDPOINT).trim() || LOCAL_GEO_UPLOAD_ENDPOINT
  const name = String(args.name || '').trim() || 'local.geojson'
  const text = String(args.text || '')
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: 'Missing text' }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, text }),
    })
    const json = (await res.json()) as { ok?: unknown; url?: unknown; name?: unknown; error?: unknown }
    if (json && json.ok === true && typeof json.url === 'string' && json.url.trim()) {
      const outName = typeof json.name === 'string' && json.name.trim() ? json.name.trim() : name
      return { ok: true, url: json.url.trim(), name: outName }
    }
    const err = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : ''
    return { ok: false, error: err || `Geo upload failed (HTTP ${res.status})`, status: res.status }
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: unknown }).message || '')
          : ''
    return { ok: false, error: msg || 'Geo upload failed' }
  }
}
