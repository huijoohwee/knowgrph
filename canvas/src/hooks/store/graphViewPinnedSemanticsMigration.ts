import { LS_KEYS } from '@/lib/config.ls.keys'
import { getLocalStorage, lsSetInt, lsSetJson } from '@/lib/persistence'

export type GraphViewPinnedSemanticsMigrationPlan = {
  effectivePinnedByNodeId: Record<string, boolean>
  persistedPinnedByNodeId: Record<string, boolean> | null
  shouldPersistVersion: boolean
}

export const normalizePinnedByNodeId = (source: Record<string, boolean> | null | undefined): Record<string, boolean> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    if (!key) continue
    out[key] = !!v
  }
  return out
}

export const normalizePosByNodeId = (
  source: Record<string, { top: number; left: number }> | null | undefined,
): Record<string, { top: number; left: number }> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, { top: number; left: number }> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    const top = typeof v?.top === 'number' && Number.isFinite(v.top) ? v.top : null
    const left = typeof v?.left === 'number' && Number.isFinite(v.left) ? v.left : null
    if (!key || top == null || left == null) continue
    out[key] = { top, left }
  }
  return out
}

export const normalizeWorldByNodeId = (
  source: Record<string, { x: number; y: number }> | null | undefined,
): Record<string, { x: number; y: number }> => {
  if (!source || typeof source !== 'object') return {}
  const out: Record<string, { x: number; y: number }> = {}
  for (const [k, v] of Object.entries(source)) {
    const key = String(k || '').trim()
    const x = typeof v?.x === 'number' && Number.isFinite(v.x) ? v.x : null
    const y = typeof v?.y === 'number' && Number.isFinite(v.y) ? v.y : null
    if (!key || x == null || y == null) continue
    out[key] = { x, y }
  }
  return out
}

const readStorageInt = (storage: Storage | null, key: string, fallback: number): number => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw == null) return fallback
    const value = parseInt(String(raw).trim(), 10)
    return Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

const readStorageJson = <T>(
  storage: Storage | null,
  key: string,
  fallback: T,
  parse: (raw: unknown) => T,
): T => {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    return parse(JSON.parse(raw) as unknown)
  } catch {
    return fallback
  }
}

const readPinnedByNodeIdFromStorage = (storage: Storage | null): Record<string, boolean> =>
  readStorageJson(storage, LS_KEYS.flowWidgetPinnedByNodeId, {}, raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const id = String(k || '').trim()
      if (!id) continue
      out[id] = !!v
    }
    return out
  })

const readPosByNodeIdFromStorage = (storage: Storage | null): Record<string, { top: number; left: number }> =>
  readStorageJson(storage, LS_KEYS.flowWidgetPosByNodeId, {}, raw =>
    normalizePosByNodeId(raw as Record<string, { top: number; left: number }> | null | undefined),
  )

const readWorldByNodeIdFromStorage = (storage: Storage | null): Record<string, { x: number; y: number }> =>
  readStorageJson(storage, LS_KEYS.flowWidgetWorldPosByNodeId, {}, raw =>
    normalizeWorldByNodeId(raw as Record<string, { x: number; y: number }> | null | undefined),
  )

export const planGraphViewPinnedSemanticsMigration = (
  storage: Storage | null = getLocalStorage(),
): GraphViewPinnedSemanticsMigrationPlan => {
  const parsed = readPinnedByNodeIdFromStorage(storage)
  const version = readStorageInt(storage, LS_KEYS.flowWidgetPinnedSemanticsVersion, 0)
  if (version >= 2) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: false,
    }
  }

  const ids = Object.keys(parsed)
  if (ids.length === 0) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: true,
    }
  }

  const posById = readPosByNodeIdFromStorage(storage)
  const worldById = readWorldByNodeIdFromStorage(storage)

  let evidence = 0
  let total = 0
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!
    const pinned = parsed[id]
    const floating = posById[id]
    const world = worldById[id]
    const hasFloating =
      floating != null
      && typeof floating === 'object'
      && Number.isFinite((floating as { top?: unknown }).top)
      && Number.isFinite((floating as { left?: unknown }).left)
    const hasWorld =
      world != null
      && typeof world === 'object'
      && Number.isFinite((world as { x?: unknown }).x)
      && Number.isFinite((world as { y?: unknown }).y)
    if (!hasFloating && !hasWorld) continue
    total += 1

    const suggestsInverted =
      (pinned === true && hasFloating && !hasWorld) ||
      (pinned === false && hasWorld && !hasFloating)
    if (suggestsInverted) evidence += 1
  }

  const shouldInvert = total > 0 && evidence / total >= 0.75
  if (!shouldInvert) {
    return {
      effectivePinnedByNodeId: parsed,
      persistedPinnedByNodeId: null,
      shouldPersistVersion: true,
    }
  }

  const flipped: Record<string, boolean> = {}
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!
    flipped[id] = !parsed[id]
  }
  return {
    effectivePinnedByNodeId: flipped,
    persistedPinnedByNodeId: flipped,
    shouldPersistVersion: true,
  }
}

export const applyGraphViewPinnedSemanticsMigration = (storage: Storage | null = getLocalStorage()): boolean => {
  const plan = planGraphViewPinnedSemanticsMigration(storage)
  if (!plan.shouldPersistVersion || !storage) return false
  if (plan.persistedPinnedByNodeId) {
    lsSetJson(LS_KEYS.flowWidgetPinnedByNodeId, plan.persistedPinnedByNodeId)
  }
  lsSetInt(LS_KEYS.flowWidgetPinnedSemanticsVersion, 2)
  return true
}
