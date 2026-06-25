import React from 'react'
import { type CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { useTimelinePreviewBootstrap, type TimelinePreviewBootstrap } from './useTimelinePreviewBootstrap'
import { type TimelinePreviewSurfaceIntent } from './useTimelinePreviewSurfaceModel'

const EMPTY_PREVIEW_ROUTE_INVENTORY: readonly CommandMenuRichMediaItem[] = []

type TimelinePreviewMediaRouteEntryArgs = {
  intent: 'media'
  inventoryItems: readonly CommandMenuRichMediaItem[]
  markdownDocumentName: string
  markdownText: string
  selectedRowKey?: string | null
}

type TimelinePreviewMonitorRouteEntryArgs = {
  intent: 'monitor'
  inventoryItems?: readonly CommandMenuRichMediaItem[]
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
  sourceCount?: number
  spanCount?: number
}

export type TimelinePreviewRouteEntryArgs =
  | TimelinePreviewMediaRouteEntryArgs
  | TimelinePreviewMonitorRouteEntryArgs

export type TimelinePreviewRouteEntry = {
  bootstrap: TimelinePreviewBootstrap
  intent: TimelinePreviewSurfaceIntent
  maxMinutes: number
  positionMinutes: number
  selectedRowKey?: string | null
  sourceCount?: number
  spanCount?: number
}

export function useTimelinePreviewRouteEntry(args: TimelinePreviewRouteEntryArgs): TimelinePreviewRouteEntry {
  const previewBootstrap = useTimelinePreviewBootstrap({
    inventoryItems: args.inventoryItems || EMPTY_PREVIEW_ROUTE_INVENTORY,
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    selectedRowKey: args.selectedRowKey,
  })

  return React.useMemo(() => ({
    bootstrap: previewBootstrap,
    intent: args.intent,
    maxMinutes: args.intent === 'media' ? previewBootstrap.collection.sequenceMaxMinutes : args.maxMinutes,
    positionMinutes: args.intent === 'media' ? 0 : args.positionMinutes,
    selectedRowKey: args.selectedRowKey,
    sourceCount: args.intent === 'media' ? undefined : args.sourceCount,
    spanCount: args.intent === 'media' ? undefined : args.spanCount,
  }), [
    previewBootstrap,
    args.intent,
    args.intent === 'media' ? previewBootstrap.collection.sequenceMaxMinutes : args.maxMinutes,
    args.intent === 'media' ? 0 : args.positionMinutes,
    args.selectedRowKey,
    args.intent === 'media' ? undefined : args.sourceCount,
    args.intent === 'media' ? undefined : args.spanCount,
  ])
}
