import React from 'react'
import { FileVideo, Images } from 'lucide-react'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useCommandMenuRichMediaInventory, type CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  readVideoSequenceSourcePlayableUrl,
  readVideoSequenceTimelineModelFromMarkdown,
  type VideoSequenceTimelineSource,
} from '@/components/timeline/videoSequenceTimeline'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import {
  buildMermaidGanttTimelineModel,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'
import {
  useTimelineDocumentStoreBinding,
  useTimelineTransportStoreBinding,
  useTimelineTransportSnapshotReader,
  useTimelineDocumentTransportController,
} from '@/components/timeline/timelineTransport'
import { useTimelineGanttSelectionStoreBinding } from '@/components/timeline/timelineSurfaceBindings'
import { useTimelineVideoPreviewSyncController } from '@/components/timeline/timelinePreviewSync'
import {
  buildVideoSequenceExportPlan,
  type VideoSequenceExportPlan,
} from '@/components/timeline/videoSequenceExport'
import {
  buildTimelinePreviewSyncPlan,
  resolveTimelinePlanSourceUrl,
} from '@/components/timeline/timelinePlanSync'

type MediaCanvasItem = {
  key: string
  label: string
  kind: 'image' | 'video' | 'audio' | 'iframe'
  src: string
  openUrl: string
  srcDoc?: string
  source: string
  panel?: CommandMenuRichMediaItem['panel']
  videoSequenceSource?: VideoSequenceTimelineSource
}

const clean = (value: unknown): string => String(value || '').trim()

const readVideoSequenceSourceLabel = (source: VideoSequenceTimelineSource): string => {
  return clean(source.originalName) || clean(source.relativePath).split('/').filter(Boolean).pop() || clean(source.sourceUrl) || 'Video source'
}

const coerceRichMediaKind = (kind: CommandMenuRichMediaItem['kind']): MediaCanvasItem['kind'] | '' => {
  if (kind === 'image') return 'image'
  if (kind === 'video') return 'video'
  if (kind === 'audio') return 'audio'
  if (kind === 'iframe' || kind === 'youtube' || kind === 'vimeo' || kind === 'webpage' || kind === 'tweet') return 'iframe'
  return ''
}

export const shouldIncludeRichMediaInventoryItemOnMediaCanvas = (item: CommandMenuRichMediaItem): boolean => {
  if (item.kind === 'mermaid') return false
  const nodeId = clean(item.nodeId)
  if (nodeId.startsWith('flow-diagram-')) return false
  const srcDoc = clean(item.srcDoc)
  if (/\bdata-kg-flow-diagram\b/i.test(srcDoc) || /\bdata-kg-mermaid-source\b/i.test(srcDoc)) return false
  return true
}

const toCanvasItem = (item: CommandMenuRichMediaItem): MediaCanvasItem | null => {
  if (!shouldIncludeRichMediaInventoryItemOnMediaCanvas(item)) return null
  const kind = coerceRichMediaKind(item.kind)
  if (!kind) return null
  const src = clean(item.src)
  const srcDoc = clean(item.srcDoc)
  if (!src && !srcDoc) return null
  const label = clean(item.panelTitle) || clean(item.label) || 'Rich media'
  return {
    key: clean(item.key) || `${kind}:${src || srcDoc}`,
    label,
    kind,
    src,
    openUrl: clean(item.openUrl) || src,
    srcDoc: srcDoc || undefined,
    source: item.source,
    panel: item.panel,
  }
}

function useVideoSequenceTimelineDuration(markdownText: string): number {
  return React.useMemo(() => {
    const code = resolveMermaidDiagramCode(
      readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'),
      'gantt',
    )
    if (!code) return 0
    return Math.max(0, buildMermaidGanttTimelineModel(code).durationMinutes || 0)
  }, [markdownText])
}

function MediaCanvasSyncedPanel({
  documentKey,
  exportPlan,
  item,
  sequenceMaxMinutes,
}: {
  documentKey: string
  exportPlan: VideoSequenceExportPlan | null
  item: MediaCanvasItem
  sequenceMaxMinutes: number
}) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const panelState = React.useMemo(
    () => item.panel || buildStaticRichMediaPanelOverlayState({ renderKind: item.kind }),
    [item.kind, item.panel],
  )
  const syncEnabled = item.source === 'video-sequence' && item.kind === 'video' && sequenceMaxMinutes > 0
  const syncSource = item.videoSequenceSource || null
  const {
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  } = useTimelineTransportStoreBinding()
  const {
    playbackPosition: positionMinutes,
    playing,
    playbackRate,
    setTransportPlaybackPosition,
    setTransportPlaying,
  } = useTimelineDocumentTransportController({
    active: syncEnabled,
    documentKey,
    maxPosition: sequenceMaxMinutes,
    transportDocumentKey,
    transportPosition,
    transportPlaying,
    transportPlaybackRate,
    setTimelineTransportState,
  })

  const readVideo = React.useCallback((): HTMLVideoElement | null => {
    return rootRef.current?.querySelector('video') || null
  }, [])

  const readTransportSnapshot = useTimelineTransportSnapshotReader({
    transportDocumentKey,
    transportPosition,
  })

  useTimelineVideoPreviewSyncController({
    active: syncEnabled,
    documentKey,
    exportPlan,
    maxPosition: sequenceMaxMinutes,
    mediaKey: item.src,
    playbackPosition: positionMinutes,
    playbackRate,
    playing,
    readTransportSnapshot,
    readVideo,
    setTransportPlaybackPosition,
    setTransportPlaying,
    source: syncSource,
  })

  return (
    <article
      ref={rootRef}
      className="min-h-[18rem] overflow-hidden"
      data-kg-media-canvas-item="1"
      data-kg-media-canvas-kind={item.kind}
      data-kg-media-canvas-source={item.source}
      data-kg-media-canvas-rich-media-panel="1"
      data-kg-video-sequence-media-sync={syncEnabled ? '1' : undefined}
    >
      <RichMediaPanel
        title={item.label}
        url={item.src}
        openUrl={item.openUrl}
        srcDoc={item.srcDoc}
        kind={item.kind}
        interactive
        videoControls={syncEnabled ? false : undefined}
        panelChrome="flowEditor"
        scrollOwner="media"
        panel={panelState}
        style={{ height: '100%', minHeight: '18rem' }}
      />
    </article>
  )
}

export default function MediaCanvas() {
  const { items } = useCommandMenuRichMediaInventory()
  const { markdownDocumentName, markdownText } = useTimelineDocumentStoreBinding()
  const { selectedRowKey: selectedGanttRowKey } = useTimelineGanttSelectionStoreBinding()
  const documentKey = clean(markdownDocumentName)
  const sequenceMaxMinutes = useVideoSequenceTimelineDuration(markdownText)
  const videoSequenceModel = React.useMemo(
    () => readVideoSequenceTimelineModelFromMarkdown(markdownText),
    [markdownText],
  )
  const videoSequenceGanttCode = React.useMemo(
    () => resolveMermaidDiagramCode(
      readYamlFrontmatterMermaidDiagramCodes(markdownText, 'gantt'),
      'gantt',
    ),
    [markdownText],
  )
  const videoSequenceExportPlan = React.useMemo(
    () => buildVideoSequenceExportPlan({
      code: videoSequenceGanttCode,
      filenameHint: markdownDocumentName,
      sources: videoSequenceModel?.sources || [],
    }),
    [markdownDocumentName, videoSequenceGanttCode, videoSequenceModel?.sources],
  )
  const videoSequencePreviewSyncPlan = React.useMemo(
    () => buildTimelinePreviewSyncPlan({
      code: videoSequenceGanttCode,
      filenameHint: markdownDocumentName,
      selectedRowKey: selectedGanttRowKey,
      sources: videoSequenceModel?.sources || [],
    }),
    [markdownDocumentName, selectedGanttRowKey, videoSequenceGanttCode, videoSequenceModel?.sources],
  )
  const videoSequenceItems = React.useMemo<MediaCanvasItem[]>(() => {
    if (!videoSequenceModel?.sources.length) return []
    return videoSequenceModel.sources.flatMap((source, index): MediaCanvasItem[] => {
      const src = resolveTimelinePlanSourceUrl(source)
      if (!src) return []
      const label = readVideoSequenceSourceLabel(source)
      return [{
        key: `video-sequence:${src}`,
        label,
        kind: 'video' as const,
        src,
        openUrl: readVideoSequenceSourcePlayableUrl(source) || src,
        source: 'video-sequence',
        videoSequenceSource: source,
      }]
    })
  }, [videoSequenceModel])
  const mediaItems = React.useMemo<MediaCanvasItem[]>(() => {
    const out = [...videoSequenceItems]
    const seen = new Set(out.map(item => `${item.kind}:${item.src || item.srcDoc || item.key}`))
    for (const item of items) {
      const canvasItem = toCanvasItem(item)
      if (!canvasItem) continue
      const key = `${canvasItem.kind}:${canvasItem.src || canvasItem.srcDoc || canvasItem.key}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(canvasItem)
    }
    return out
  }, [items, videoSequenceItems])

  return (
    <section
      className={`${CANVAS_SURFACE_CLASS} ${CANVAS_INTERACTIVE_CLASS} h-full min-h-0 w-full overflow-auto bg-[var(--kg-canvas-bg)] p-4 text-[var(--kg-text-primary)]`}
      aria-label="Media canvas"
      data-kg-media-canvas="1"
      data-kg-media-canvas-count={mediaItems.length}
    >
      <header className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Images className="h-4 w-4" aria-hidden="true" />
          Media
        </h1>
        <p className="text-xs text-[var(--kg-text-secondary)]">{mediaItems.length} source{mediaItems.length === 1 ? '' : 's'}</p>
      </header>

      {mediaItems.length > 0 ? (
        <section className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Rich media canvas sources">
          {mediaItems.map(item => (
            <MediaCanvasSyncedPanel
              key={item.key}
              documentKey={documentKey}
              exportPlan={videoSequencePreviewSyncPlan || videoSequenceExportPlan}
              item={item}
              sequenceMaxMinutes={sequenceMaxMinutes}
            />
          ))}
        </section>
      ) : (
        <section
          className="flex min-h-[18rem] flex-col items-center justify-center rounded border border-dashed border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-6 text-center text-sm text-[var(--kg-text-secondary)]"
          aria-label="No media canvas sources"
          data-kg-media-canvas-empty="1"
        >
          <FileVideo className="mb-3 h-6 w-6" aria-hidden="true" />
          No rich media sources found in the active document.
        </section>
      )}
    </section>
  )
}
