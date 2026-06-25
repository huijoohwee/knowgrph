import React from 'react'
import {
  type TimelinePreviewCollection,
  type TimelinePreviewCollectionItem,
} from './useTimelinePreviewCollection'

export type TimelinePreviewSurfaceIntent = 'media' | 'monitor' | 'timeline'

export type TimelinePreviewSurfaceFamily = {
  familyId: string
  items: TimelinePreviewCollectionItem[]
  label: string
  primaryItem: TimelinePreviewCollectionItem
  source: string
  visibleItems: TimelinePreviewCollectionItem[]
}

export type TimelinePreviewSurfaceModel = {
  count: number
  groups: TimelinePreviewSurfaceFamily[]
  intent: TimelinePreviewSurfaceIntent
  items: TimelinePreviewCollectionItem[]
}

const clean = (value: unknown): string => String(value || '').trim()

const readTimelinePreviewSourceFamilyKey = (item: TimelinePreviewCollectionItem): string => {
  return clean(item.videoSequenceSource?.relativePath)
    || clean(item.videoSequenceSource?.originalName)
    || clean(item.videoSequenceSource?.sourceUrl)
    || clean(item.src)
    || clean(item.key)
}

const readTimelinePreviewFamilyLabel = (item: TimelinePreviewCollectionItem): string => {
  if (item.source === 'video-sequence') {
    const relativePathLabel = clean(item.videoSequenceSource?.relativePath)
      .split('/')
      .filter(Boolean)
      .pop()
    return clean(item.videoSequenceSource?.originalName)
      || relativePathLabel
      || clean(item.videoSequenceSource?.sourceUrl)
      || item.label
      || 'Video preview'
  }
  return item.label || 'Preview'
}

export const resolveTimelinePreviewFamilyId = (item: TimelinePreviewCollectionItem): string => {
  const source = clean(item.source) || 'unknown'
  if (source === 'video-sequence') {
    return `${source}:${readTimelinePreviewSourceFamilyKey(item)}`
  }
  return `${source}:${item.kind}:${clean(item.src) || clean(item.srcDoc) || clean(item.key)}`
}

export const isTimelinePreviewItemVisibleForSurfaceIntent = (args: {
  intent: TimelinePreviewSurfaceIntent
  item: TimelinePreviewCollectionItem
}): boolean => {
  if (args.intent === 'media') return true
  if (args.intent === 'monitor' || args.intent === 'timeline') {
    return args.item.source === 'video-sequence'
  }
  return true
}

export function useTimelinePreviewSurfaceModel(args: {
  collection: TimelinePreviewCollection
  intent: TimelinePreviewSurfaceIntent
}): TimelinePreviewSurfaceModel {
  return React.useMemo(() => {
    const groupsById = new Map<string, TimelinePreviewCollectionItem[]>()
    for (const item of args.collection.items) {
      const familyId = resolveTimelinePreviewFamilyId(item)
      const existingItems = groupsById.get(familyId)
      if (existingItems) {
        existingItems.push(item)
        continue
      }
      groupsById.set(familyId, [item])
    }
    const groups = [...groupsById.entries()]
      .map(([familyId, items]) => {
        const primaryItem = items[0]
        const visibleItems = items.filter(item => isTimelinePreviewItemVisibleForSurfaceIntent({
          intent: args.intent,
          item,
        }))
        if (!primaryItem || visibleItems.length === 0) return null
        return {
          familyId,
          items,
          label: readTimelinePreviewFamilyLabel(primaryItem),
          primaryItem,
          source: primaryItem.source,
          visibleItems,
        } satisfies TimelinePreviewSurfaceFamily
      })
      .filter((group): group is TimelinePreviewSurfaceFamily => !!group)
    return {
      count: groups.reduce((total, group) => total + group.visibleItems.length, 0),
      groups,
      intent: args.intent,
      items: groups.flatMap(group => group.visibleItems),
    }
  }, [args.collection, args.intent])
}
