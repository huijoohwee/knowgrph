import React from 'react'
import { FileVideo, Images } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import RichMediaPanel from '@/components/RichMediaPanel'
import { useCommandMenuRichMediaInventory, type CommandMenuRichMediaItem } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { buildStaticRichMediaPanelOverlayState } from '@/lib/render/richMediaSsot'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT,
  readVideoSequenceSourcePlayableUrl,
  readVideoSequenceTimelineModelFromMarkdown,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelinePositionMinutes,
  type VideoSequenceTimelinePlaybackRequestDetail,
  type VideoSequenceTimelineSource,
} from '@/components/timeline/videoSequenceTimeline'
import { resolveVideoSequenceSourceRuntimeUrl } from '@/components/timeline/videoSequenceSourceRegistry'
import { CANVAS_INTERACTIVE_CLASS, CANVAS_SURFACE_CLASS } from '@/lib/canvas/surface'
import {
  buildMermaidGanttTimelineModel,
} from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'
import {
  clampTimelineTransportValue,
  resolveTimelineTransportPlaybackRate,
} from '@/components/timeline/timelineTransport'
import {
  buildVideoSequenceExportPlan,
  buildVideoSequencePreviewSyncPlan,
  resolveVideoSequenceExportPositionSourceTime,
  resolveVideoSequenceExportSourceTimePosition,
  type VideoSequenceExportPlan,
} from '@/components/timeline/videoSequenceExport'

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
const VIDEO_SEQUENCE_SYNC_EPSILON_SECONDS = 0.25
const VIDEO_SEQUENCE_SYNC_EPSILON_MINUTES = 0.005

const readVideoSequenceSourceLabel = (source: VideoSequenceTimelineSource): string => {
  return clean(source.originalName) || clean(source.relativePath).split('/').filter(Boolean).pop() || clean(source.sourceUrl) || 'Video source'
}

const resolveVideoSequenceCanvasUrl = (source: VideoSequenceTimelineSource): string => {
  return readVideoSequenceSourcePlayableUrl(source) || resolveVideoSequenceSourceRuntimeUrl(source)
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
  const playbackFallbackRef = React.useRef(false)
  const panelState = React.useMemo(
    () => item.panel || buildStaticRichMediaPanelOverlayState({ renderKind: item.kind }),
    [item.kind, item.panel],
  )
  const syncEnabled = item.source === 'video-sequence' && item.kind === 'video' && sequenceMaxMinutes > 0
  const syncSource = item.videoSequenceSource || null
  const {
    transportDocumentKey,
    transportPositionMinutes,
    transportPlaying,
    transportPlaybackRate,
    setGanttTimelineTransportState,
  } = useGraphStore(
    useShallow(state => ({
      transportDocumentKey: state.ganttTimelineTransportDocumentKey || '',
      transportPositionMinutes: state.ganttTimelineTransportPositionMinutes || 0,
      transportPlaying: state.ganttTimelineTransportPlaying === true,
      transportPlaybackRate: state.ganttTimelineTransportPlaybackRate || 1,
      setGanttTimelineTransportState: state.setGanttTimelineTransportState,
    })),
  )
  const positionMinutes = transportDocumentKey === documentKey
    ? clampTimelineTransportValue(transportPositionMinutes, 0, sequenceMaxMinutes)
    : 0
  const playbackRate = resolveTimelineTransportPlaybackRate(transportPlaybackRate, 1)

  const readVideo = React.useCallback((): HTMLVideoElement | null => {
    return rootRef.current?.querySelector('video') || null
  }, [])

  React.useEffect(() => {
    playbackFallbackRef.current = false
  }, [documentKey, item.src])

  const resolveTargetSeconds = React.useCallback((video: HTMLVideoElement, nextPositionMinutes: number): number | null => {
    const durationSeconds = video.duration
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
    const resolvedSourceTime = syncSource
      ? resolveVideoSequenceExportPositionSourceTime({
        plan: exportPlan,
        positionMinutes: nextPositionMinutes,
        source: syncSource,
        sourceDurationSeconds: durationSeconds,
      })
      : null
    return resolvedSourceTime?.sourceTimeSeconds ?? resolveVideoSequenceTimelineMediaSeconds({
      durationSeconds,
      maxMinutes: sequenceMaxMinutes,
      positionMinutes: nextPositionMinutes,
    })
  }, [exportPlan, sequenceMaxMinutes, syncSource])

  const applyVideoTime = React.useCallback((video: HTMLVideoElement, nextPositionMinutes: number): void => {
    const targetSeconds = resolveTargetSeconds(video, nextPositionMinutes)
    if (targetSeconds == null) return
    if (Math.abs((video.currentTime || 0) - targetSeconds) > VIDEO_SEQUENCE_SYNC_EPSILON_SECONDS) {
      video.currentTime = targetSeconds
    }
  }, [resolveTargetSeconds])

  const requestNativePlayback = React.useCallback((video: HTMLVideoElement): void => {
    if (!video.paused || playbackFallbackRef.current) return
    const play = typeof video.play === 'function' ? video.play.bind(video) : null
    if (!play) {
      playbackFallbackRef.current = true
      video.setAttribute('data-kg-video-sequence-playback-fallback', 'seek')
      return
    }
    void play().catch(() => {
      playbackFallbackRef.current = true
      video.setAttribute('data-kg-video-sequence-playback-fallback', 'seek')
    })
  }, [])

  React.useEffect(() => {
    if (!syncEnabled) return
    let raf = 0
    let cancelled = false
    let cleanupVideo: (() => void) | null = null
    const syncVideo = () => {
      if (cancelled) return
      const video = readVideo()
      if (!video) {
        raf = window.requestAnimationFrame(syncVideo)
        return
      }
      if (cleanupVideo) return
      video.setAttribute('data-kg-video-sequence-media-sync', '1')
      const applyTransportPosition = () => {
        const storePositionMinutes = useGraphStore.getState().ganttTimelineTransportPositionMinutes || 0
        applyVideoTime(video, storePositionMinutes)
      }
      const writeTransportPosition = () => {
        const durationSeconds = video.duration
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return
        const current = useGraphStore.getState()
        const resolvedPosition = syncSource
          ? resolveVideoSequenceExportSourceTimePosition({
            currentTimeSeconds: video.currentTime || 0,
            plan: exportPlan,
            preferredPositionMinutes: current.ganttTimelineTransportPositionMinutes || 0,
            source: syncSource,
            sourceDurationSeconds: durationSeconds,
          })
          : null
        const nextPosition = resolvedPosition ?? resolveVideoSequenceTimelinePositionMinutes({
          currentTimeSeconds: video.currentTime || 0,
          durationSeconds,
          maxMinutes: sequenceMaxMinutes,
        })
        if (
          current.ganttTimelineTransportDocumentKey !== documentKey ||
          Math.abs((current.ganttTimelineTransportPositionMinutes || 0) - nextPosition) > VIDEO_SEQUENCE_SYNC_EPSILON_MINUTES
        ) {
          current.setGanttTimelineTransportState({ documentKey, positionMinutes: nextPosition })
        }
      }
      const writePlaying = () => {
        if (video.paused || video.ended) writeTransportPosition()
        useGraphStore.getState().setGanttTimelineTransportState({ documentKey, playing: !video.paused && !video.ended })
      }
      video.addEventListener('loadedmetadata', applyTransportPosition)
      video.addEventListener('timeupdate', writeTransportPosition)
      video.addEventListener('seeking', writeTransportPosition)
      video.addEventListener('play', writePlaying)
      video.addEventListener('pause', writePlaying)
      video.addEventListener('ended', writePlaying)
      applyTransportPosition()
      cleanupVideo = () => {
        video.removeEventListener('loadedmetadata', applyTransportPosition)
        video.removeEventListener('timeupdate', writeTransportPosition)
        video.removeEventListener('seeking', writeTransportPosition)
        video.removeEventListener('play', writePlaying)
        video.removeEventListener('pause', writePlaying)
        video.removeEventListener('ended', writePlaying)
      }
    }
    syncVideo()
    return () => {
      cancelled = true
      if (raf) window.cancelAnimationFrame(raf)
      cleanupVideo?.()
    }
  }, [applyVideoTime, documentKey, exportPlan, readVideo, sequenceMaxMinutes, syncEnabled, syncSource])

  React.useEffect(() => {
    if (!syncEnabled) return
    const handlePlaybackRequest = (event: Event) => {
      const detail = (event as CustomEvent<VideoSequenceTimelinePlaybackRequestDetail>).detail
      if (!detail || clean(detail.documentKey) !== documentKey) return
      const video = readVideo()
      if (!video) return
      applyVideoTime(video, detail.positionMinutes)
      const nextPlaybackRate = resolveTimelineTransportPlaybackRate(detail.playbackRate, playbackRate)
      if (video.playbackRate !== nextPlaybackRate) video.playbackRate = nextPlaybackRate
      if (detail.playing) {
        playbackFallbackRef.current = false
        video.removeAttribute('data-kg-video-sequence-playback-fallback')
        requestNativePlayback(video)
      } else if (!video.paused) {
        playbackFallbackRef.current = false
        video.removeAttribute('data-kg-video-sequence-playback-fallback')
        video.pause()
      }
    }
    window.addEventListener(VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT, handlePlaybackRequest)
    return () => {
      window.removeEventListener(VIDEO_SEQUENCE_TIMELINE_PLAYBACK_REQUEST_EVENT, handlePlaybackRequest)
    }
  }, [applyVideoTime, documentKey, playbackRate, readVideo, requestNativePlayback, syncEnabled])

  React.useEffect(() => {
    if (!syncEnabled) return
    const video = readVideo()
    if (!video) return
    applyVideoTime(video, positionMinutes)
    if (video.playbackRate !== playbackRate) video.playbackRate = playbackRate
    const shouldPlay = transportDocumentKey === documentKey && transportPlaying
    if (shouldPlay && video.paused) {
      requestNativePlayback(video)
    } else if (!shouldPlay && !video.paused) {
      playbackFallbackRef.current = false
      video.removeAttribute('data-kg-video-sequence-playback-fallback')
      video.pause()
    }
  }, [applyVideoTime, documentKey, playbackRate, positionMinutes, readVideo, requestNativePlayback, syncEnabled, transportDocumentKey, transportPlaying])

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
  const { markdownDocumentName, markdownText, selectedGanttRowKey } = useGraphStore(
    useShallow(s => ({
      markdownDocumentName: s.markdownDocumentName || '',
      markdownText: s.markdownDocumentText || '',
      selectedGanttRowKey: s.mermaidDiagramSelectedRowKeyByKind.gantt || '',
    })),
  )
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
    () => buildVideoSequencePreviewSyncPlan({
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
      const src = resolveVideoSequenceCanvasUrl(source)
      if (!src) return []
      const label = readVideoSequenceSourceLabel(source)
      return [{
        key: `video-sequence:${clean(source.id) || `${label}:${index}`}`,
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
