import type { GraphFieldId, GraphFieldSettings, GraphFieldSettingsById } from '@/features/graph-fields/graphFields'
import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readJsonFromStorage } from '@/lib/persistence'

type GraphFieldSettingsIndexCache = {
  raw: string | null
  parsed: GraphFieldId[]
}

type GraphFieldSettingsEntryCache = {
  raw: string | null
  parsed: GraphFieldSettings | null
}

const GRAPH_FIELD_SETTINGS_ENTRY_CACHE_LIMIT = 256

let graphFieldSettingsIndexCache: GraphFieldSettingsIndexCache = { raw: null, parsed: [] }
const graphFieldSettingsEntryCache = new Map<string, GraphFieldSettingsEntryCache>()

const getGraphFieldSettingsIndexKey = (): string => `${LS_KEYS.graphFieldSettingsById}:index`
const getGraphFieldSettingsEntryKey = (fieldId: GraphFieldId): string =>
  `${LS_KEYS.graphFieldSettingsById}:${encodeURIComponent(String(fieldId || '').trim())}`

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const noteGraphFieldSettingsEntryCache = (storageKey: string, next: GraphFieldSettingsEntryCache): void => {
  if (!storageKey) return
  if (graphFieldSettingsEntryCache.has(storageKey)) {
    graphFieldSettingsEntryCache.delete(storageKey)
  }
  graphFieldSettingsEntryCache.set(storageKey, next)
  if (graphFieldSettingsEntryCache.size <= GRAPH_FIELD_SETTINGS_ENTRY_CACHE_LIMIT) return
  const oldestKey = graphFieldSettingsEntryCache.keys().next().value
  if (typeof oldestKey === 'string' && oldestKey) {
    graphFieldSettingsEntryCache.delete(oldestKey)
  }
}

export function normalizeGraphFieldSetting(raw: unknown): GraphFieldSettings | null {
  if (!isRecord(raw)) return null
  const displayName = raw.displayName
  const isHidden = raw.isHidden
  const fieldTypeRaw = raw.fieldType
  const isCustomRaw = raw.isCustom
  const descriptionRaw = raw.description
  const defaultValueRaw = raw.defaultValue
  const selectOptionsRaw = raw.selectOptions
  const decimalPlacesRaw = raw.decimalPlaces
  const currencyCodeRaw = raw.currencyCode
  const urlProtocolRaw = raw.urlProtocol
  const dateTimeFormatRaw = raw.dateTimeFormat
  if (typeof displayName !== 'string') return null
  if (typeof isHidden !== 'boolean') return null
  const base: Record<string, unknown> = { displayName, isHidden }
  if (typeof fieldTypeRaw === 'string') base.fieldType = fieldTypeRaw
  if (typeof isCustomRaw === 'boolean') base.isCustom = isCustomRaw
  if (typeof descriptionRaw === 'string') base.description = descriptionRaw
  if (
    defaultValueRaw === null
    || typeof defaultValueRaw === 'string'
    || typeof defaultValueRaw === 'number'
    || typeof defaultValueRaw === 'boolean'
  ) {
    base.defaultValue = defaultValueRaw
  }
  if (Array.isArray(selectOptionsRaw)) {
    const opts = selectOptionsRaw
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim())
      .filter(Boolean)
    if (opts.length > 0) base.selectOptions = Array.from(new Set(opts))
  }
  if (typeof decimalPlacesRaw === 'number' && Number.isFinite(decimalPlacesRaw)) {
    base.decimalPlaces = Math.min(10, Math.max(0, Math.floor(decimalPlacesRaw)))
  }
  if (typeof currencyCodeRaw === 'string') base.currencyCode = currencyCodeRaw
  if (urlProtocolRaw === 'any' || urlProtocolRaw === 'http' || urlProtocolRaw === 'https') {
    base.urlProtocol = urlProtocolRaw
  }
  if (dateTimeFormatRaw === 'ISO' || dateTimeFormatRaw === 'Local') {
    base.dateTimeFormat = dateTimeFormatRaw
  }
  return base as GraphFieldSettings
}

export function parseGraphFieldSettingsById(raw: unknown): GraphFieldSettingsById | null {
  if (!isRecord(raw)) return null
  const next: GraphFieldSettingsById = {}
  for (const [k, v] of Object.entries(raw)) {
    const fieldId = String(k || '').trim() as GraphFieldId
    if (!fieldId) continue
    const normalized = normalizeGraphFieldSetting(v)
    if (!normalized) continue
    next[fieldId] = normalized
  }
  return next
}

const readGraphFieldSettingsIndex = (storage: Storage | null): GraphFieldId[] => {
  if (!storage) return []
  try {
    const raw = storage.getItem(getGraphFieldSettingsIndexKey())
    if (!raw) {
      graphFieldSettingsIndexCache = { raw: null, parsed: [] }
      return []
    }
    if (raw === graphFieldSettingsIndexCache.raw) return graphFieldSettingsIndexCache.parsed
    const parsed = JSON.parse(raw) as unknown
    const ids = Array.isArray(parsed)
      ? parsed.map(v => String(v || '').trim()).filter(Boolean) as GraphFieldId[]
      : []
    graphFieldSettingsIndexCache = { raw, parsed: ids }
    return ids
  } catch {
    return []
  }
}

const readGraphFieldSettingEntry = (storage: Storage | null, fieldId: GraphFieldId): GraphFieldSettings | null => {
  if (!storage) return null
  const storageKey = getGraphFieldSettingsEntryKey(fieldId)
  let raw: string | null = null
  try {
    raw = storage.getItem(storageKey)
  } catch {
    return null
  }
  const cached = graphFieldSettingsEntryCache.get(storageKey)
  if (cached && cached.raw === raw) return cached.parsed
  if (!raw) {
    noteGraphFieldSettingsEntryCache(storageKey, { raw: null, parsed: null })
    return null
  }
  try {
    const parsed = normalizeGraphFieldSetting(JSON.parse(raw) as unknown)
    noteGraphFieldSettingsEntryCache(storageKey, { raw, parsed })
    return parsed
  } catch {
    noteGraphFieldSettingsEntryCache(storageKey, { raw, parsed: null })
    return null
  }
}

export function readGraphFieldSettingsById(storageArg?: Storage | null): GraphFieldSettingsById {
  const storage = storageArg === undefined ? getLocalStorage() : storageArg
  const ids = readGraphFieldSettingsIndex(storage)
  if (ids.length > 0) {
    const out: GraphFieldSettingsById = {}
    for (let i = 0; i < ids.length; i += 1) {
      const fieldId = ids[i]
      const entry = readGraphFieldSettingEntry(storage, fieldId)
      if (!entry) continue
      out[fieldId] = entry
    }
    return out
  }
  return readJsonFromStorage(storage, LS_KEYS.graphFieldSettingsById, {} as GraphFieldSettingsById, parseGraphFieldSettingsById)
}

export function writeGraphFieldSettingsById(
  settingsById: GraphFieldSettingsById,
  storageArg?: Storage | null,
): GraphFieldSettingsById {
  const storage = storageArg === undefined ? getLocalStorage() : storageArg
  const normalized = parseGraphFieldSettingsById(settingsById) || {}
  if (!storage) return normalized
  const prev = readGraphFieldSettingsById(storage)
  const nextIds = Object.keys(normalized).map(id => String(id || '').trim()).filter(Boolean).sort() as GraphFieldId[]
  try {
    const nextIndexRaw = JSON.stringify(nextIds)
    if (nextIndexRaw !== graphFieldSettingsIndexCache.raw) {
      storage.setItem(getGraphFieldSettingsIndexKey(), nextIndexRaw)
      graphFieldSettingsIndexCache = { raw: nextIndexRaw, parsed: nextIds }
    }
    for (let i = 0; i < nextIds.length; i += 1) {
      const fieldId = nextIds[i]
      const entry = normalized[fieldId]
      if (!entry) continue
      const storageKey = getGraphFieldSettingsEntryKey(fieldId)
      const raw = JSON.stringify(entry)
      const cached = graphFieldSettingsEntryCache.get(storageKey)
      if (!cached || cached.raw !== raw) {
        storage.setItem(storageKey, raw)
        noteGraphFieldSettingsEntryCache(storageKey, { raw, parsed: entry })
      }
    }
    for (const staleId of Object.keys(prev) as GraphFieldId[]) {
      if (normalized[staleId]) continue
      const storageKey = getGraphFieldSettingsEntryKey(staleId)
      storage.removeItem(storageKey)
      noteGraphFieldSettingsEntryCache(storageKey, { raw: null, parsed: null })
    }
    storage.removeItem(LS_KEYS.graphFieldSettingsById)
  } catch {
    void 0
  }
  return normalized
}

export function writeGraphFieldSetting(fieldId: GraphFieldId, value: GraphFieldSettings, storageArg?: Storage | null): GraphFieldSettings | null {
  const storage = storageArg === undefined ? getLocalStorage() : storageArg
  const normalized = normalizeGraphFieldSetting(value)
  if (!normalized || !storage) return normalized
  const nextIds = readGraphFieldSettingsIndex(storage)
  const normalizedFieldId = String(fieldId || '').trim() as GraphFieldId
  const deduped = nextIds.includes(normalizedFieldId) ? nextIds : [...nextIds, normalizedFieldId].sort()
  try {
    const indexRaw = JSON.stringify(deduped)
    if (indexRaw !== graphFieldSettingsIndexCache.raw) {
      storage.setItem(getGraphFieldSettingsIndexKey(), indexRaw)
      graphFieldSettingsIndexCache = { raw: indexRaw, parsed: deduped }
    }
    const storageKey = getGraphFieldSettingsEntryKey(normalizedFieldId)
    const raw = JSON.stringify(normalized)
    const cached = graphFieldSettingsEntryCache.get(storageKey)
    if (!cached || cached.raw !== raw) {
      storage.setItem(storageKey, raw)
      noteGraphFieldSettingsEntryCache(storageKey, { raw, parsed: normalized })
    }
    storage.removeItem(LS_KEYS.graphFieldSettingsById)
  } catch {
    void 0
  }
  return normalized
}

export function removeGraphFieldSetting(fieldId: GraphFieldId, storageArg?: Storage | null): void {
  const storage = storageArg === undefined ? getLocalStorage() : storageArg
  if (!storage) return
  const normalizedFieldId = String(fieldId || '').trim() as GraphFieldId
  const nextIds = readGraphFieldSettingsIndex(storage).filter(id => id !== normalizedFieldId)
  try {
    if (nextIds.length > 0) {
      const indexRaw = JSON.stringify(nextIds)
      storage.setItem(getGraphFieldSettingsIndexKey(), indexRaw)
      graphFieldSettingsIndexCache = { raw: indexRaw, parsed: nextIds }
    } else {
      storage.removeItem(getGraphFieldSettingsIndexKey())
      graphFieldSettingsIndexCache = { raw: null, parsed: [] }
    }
    const storageKey = getGraphFieldSettingsEntryKey(normalizedFieldId)
    storage.removeItem(storageKey)
    noteGraphFieldSettingsEntryCache(storageKey, { raw: null, parsed: null })
    storage.removeItem(LS_KEYS.graphFieldSettingsById)
  } catch {
    void 0
  }
}
