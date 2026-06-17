import { getCellText } from '@/features/graph-data-table/ui/fast-grid/canvasGridRender'

type NormalizedDateResult =
  | { ok: true; value: string | null }
  | { ok: false; value: null }

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function normalizeYmd(yyyy: number, mm: number, dd: number): string | null {
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
  if (yyyy < 1 || yyyy > 9999) return null
  if (mm < 1 || mm > 12) return null
  if (dd < 1 || dd > 31) return null
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  if (d.getUTCFullYear() !== yyyy) return null
  if (d.getUTCMonth() !== mm - 1) return null
  if (d.getUTCDate() !== dd) return null
  return `${String(yyyy).padStart(4, '0')}-${pad2(mm)}-${pad2(dd)}`
}

export function normalizeDateDraftToValue(draft: string): NormalizedDateResult {
  const raw = String(draft || '').trim()
  if (!raw) return { ok: true, value: null }

  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    const out = normalizeYmd(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
    return out ? { ok: true, value: out } : { ok: false, value: null }
  }

  const ymdSlash = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (ymdSlash) {
    const out = normalizeYmd(Number(ymdSlash[1]), Number(ymdSlash[2]), Number(ymdSlash[3]))
    return out ? { ok: true, value: out } : { ok: false, value: null }
  }

  const mdySlash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdySlash) {
    const out = normalizeYmd(Number(mdySlash[3]), Number(mdySlash[1]), Number(mdySlash[2]))
    return out ? { ok: true, value: out } : { ok: false, value: null }
  }

  const ms = Date.parse(raw)
  if (Number.isFinite(ms)) {
    const iso = new Date(ms).toISOString().slice(0, 10)
    return { ok: true, value: iso }
  }

  return { ok: false, value: null }
}

export function formatDateDraftFromCellValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const prefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (prefix) return `${prefix[1]}-${prefix[2]}-${prefix[3]}`
    const parsed = normalizeDateDraftToValue(trimmed)
    if (parsed.ok) return parsed.value || ''
    return trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    try {
      return new Date(value).toISOString().slice(0, 10)
    } catch {
      return String(value)
    }
  }
  if (value instanceof Date) {
    const ms = value.getTime()
    if (Number.isFinite(ms)) return new Date(ms).toISOString().slice(0, 10)
  }
  return getCellText(value)
}

