import React from 'react'

const EMPTY_TIMELINE_PREVIEW_FAMILY_DISCLOSURE_SET = new Set<string>()
const timelinePreviewFamilyDisclosureRegistry = new Map<string, Set<string>>()
const timelinePreviewFamilyDisclosureListeners = new Map<string, Set<() => void>>()

const clean = (value: unknown): string => String(value || '').trim()

function readTimelinePreviewFamilyDisclosureSnapshot(documentKey: string): Set<string> {
  return timelinePreviewFamilyDisclosureRegistry.get(documentKey) || EMPTY_TIMELINE_PREVIEW_FAMILY_DISCLOSURE_SET
}

function areTimelinePreviewFamilyDisclosureSetsEqual(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left === right) return true
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

function emitTimelinePreviewFamilyDisclosure(documentKey: string) {
  timelinePreviewFamilyDisclosureListeners.get(documentKey)?.forEach(listener => listener())
}

function subscribeTimelinePreviewFamilyDisclosure(documentKey: string, listener: () => void) {
  if (!documentKey) return () => {}
  const listeners = timelinePreviewFamilyDisclosureListeners.get(documentKey) || new Set<() => void>()
  listeners.add(listener)
  timelinePreviewFamilyDisclosureListeners.set(documentKey, listeners)
  return () => {
    const nextListeners = timelinePreviewFamilyDisclosureListeners.get(documentKey)
    nextListeners?.delete(listener)
    if (!nextListeners?.size) {
      timelinePreviewFamilyDisclosureListeners.delete(documentKey)
    }
  }
}

function updateTimelinePreviewFamilyDisclosure(documentKey: string, update: (current: Set<string>) => Set<string>) {
  if (!documentKey) return
  const current = readTimelinePreviewFamilyDisclosureSnapshot(documentKey)
  const next = update(current)
  if (areTimelinePreviewFamilyDisclosureSetsEqual(current, next)) return
  if (next.size > 0) {
    timelinePreviewFamilyDisclosureRegistry.set(documentKey, next)
  } else {
    timelinePreviewFamilyDisclosureRegistry.delete(documentKey)
  }
  emitTimelinePreviewFamilyDisclosure(documentKey)
}

export type TimelinePreviewFamilyDisclosureController = {
  autoExpandFamilyId: string
  documentKey: string
  expandedFamilyIds: ReadonlySet<string>
  toggleFamily: (familyId: string) => void
}

export function useTimelinePreviewFamilyDisclosureController(args: {
  autoExpandFamilyId?: string | null
  documentKey: string
  familyIds: readonly string[]
}): TimelinePreviewFamilyDisclosureController {
  const autoExpandFamilyId = clean(args.autoExpandFamilyId)
  const documentKey = clean(args.documentKey)
  const familyIds = React.useMemo(
    () => args.familyIds.map(familyId => clean(familyId)).filter(Boolean),
    [args.familyIds],
  )
  const familyIdSet = React.useMemo(() => new Set(familyIds), [familyIds])
  const persistedExpandedFamilyIds = React.useSyncExternalStore(
    React.useCallback(listener => subscribeTimelinePreviewFamilyDisclosure(documentKey, listener), [documentKey]),
    React.useCallback(() => readTimelinePreviewFamilyDisclosureSnapshot(documentKey), [documentKey]),
    React.useCallback(() => readTimelinePreviewFamilyDisclosureSnapshot(documentKey), [documentKey]),
  )
  React.useEffect(() => {
    if (!documentKey) return
    const staleFamilyIds = Array.from(persistedExpandedFamilyIds).filter(familyId => !familyIdSet.has(familyId))
    if (staleFamilyIds.length === 0) return
    updateTimelinePreviewFamilyDisclosure(documentKey, current => {
      const next = new Set(Array.from(current).filter(familyId => familyIdSet.has(familyId)))
      return next
    })
  }, [documentKey, familyIdSet, persistedExpandedFamilyIds])
  const expandedFamilyIds = React.useMemo(() => {
    const next = new Set(Array.from(persistedExpandedFamilyIds).filter(familyId => familyIdSet.has(familyId)))
    if (autoExpandFamilyId && familyIdSet.has(autoExpandFamilyId)) {
      next.add(autoExpandFamilyId)
    }
    return next
  }, [autoExpandFamilyId, familyIdSet, persistedExpandedFamilyIds])
  const toggleFamily = React.useCallback((familyId: string) => {
    const cleanFamilyId = clean(familyId)
    if (!documentKey || !cleanFamilyId || !familyIdSet.has(cleanFamilyId)) return
    updateTimelinePreviewFamilyDisclosure(documentKey, current => {
      const next = new Set(current)
      if (next.has(cleanFamilyId)) next.delete(cleanFamilyId)
      else next.add(cleanFamilyId)
      return next
    })
  }, [documentKey, familyIdSet])
  return {
    autoExpandFamilyId,
    documentKey,
    expandedFamilyIds,
    toggleFamily,
  }
}
