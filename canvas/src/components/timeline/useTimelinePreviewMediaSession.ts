import React from 'react'
import { buildMermaidGanttTimelineModel } from '@/lib/mermaid/mermaidGanttBarInteraction'
import {
  readYamlFrontmatterMermaidDiagramCodes,
  resolveMermaidDiagramCode,
} from '@/lib/mermaid/mermaidDiagramCode'
import {
  readVideoSequenceSourcePlayableUrl,
  readVideoSequenceTimelineModelFromMarkdown,
  type VideoSequenceTimelineSource,
} from './videoSequenceTimeline'
import { buildVideoSequenceExportPlan, type VideoSequenceExportPlan } from './videoSequenceExport'
import {
  buildTimelinePreviewSyncPlan,
  resolveTimelinePlanSourceUrl,
} from './timelinePlanSync'

export type TimelinePreviewMediaSourceItem = {
  kind: 'image' | 'video' | 'audio'
  key: string
  label: string
  openUrl: string
  source: VideoSequenceTimelineSource
  src: string
}

export type TimelinePreviewMediaSession = {
  exportPlan: VideoSequenceExportPlan | null
  items: TimelinePreviewMediaSourceItem[]
  previewPlan: VideoSequenceExportPlan | null
  sequenceMaxMinutes: number
}

const clean = (value: unknown): string => String(value || '').trim()

const readTimelinePreviewMediaSourceLabel = (source: VideoSequenceTimelineSource): string => {
  return clean(source.originalName)
    || clean(source.relativePath).split('/').filter(Boolean).pop()
    || clean(source.sourceUrl)
    || 'Media source'
}

const readTimelinePreviewMediaSourceKind = (source: VideoSequenceTimelineSource): TimelinePreviewMediaSourceItem['kind'] => {
  const signature = [
    source.mimeHint,
    source.originalName,
    source.relativePath,
    source.sourceUrl,
  ].join(' ').toLowerCase()
  if (/\b(?:audio|mpeg|mp3|wav|aac|m4a|opus|ogg)\b|\.m(?:p3|4a)\b|\.(?:wav|aac|opus|ogg)\b/.test(signature)) return 'audio'
  if (/\bimage\b|\.avif\b|\.gif\b|\.jpe?g\b|\.png\b|\.svg\b|\.webp\b/.test(signature)) return 'image'
  return 'video'
}

export function useTimelinePreviewMediaSession(args: {
  markdownDocumentName: string
  markdownText: string
  selectedRowKey?: string | null
}): TimelinePreviewMediaSession {
  return React.useMemo(() => {
    const code = resolveMermaidDiagramCode(
      readYamlFrontmatterMermaidDiagramCodes(args.markdownText, 'gantt'),
      'gantt',
    )
    if (!code) {
      return {
        exportPlan: null,
        items: [],
        previewPlan: null,
        sequenceMaxMinutes: 0,
      }
    }
    const videoSequenceModel = readVideoSequenceTimelineModelFromMarkdown(args.markdownText)
    const sources = videoSequenceModel?.sources || []
    const exportPlan = buildVideoSequenceExportPlan({
      code,
      filenameHint: args.markdownDocumentName,
      sources,
    })
    const previewPlan = buildTimelinePreviewSyncPlan({
      code,
      filenameHint: args.markdownDocumentName,
      selectedRowKey: args.selectedRowKey,
      sources,
    })
    const items = sources.flatMap((source): TimelinePreviewMediaSourceItem[] => {
      const src = resolveTimelinePlanSourceUrl(source)
      if (!src) return []
      return [{
        key: `video-sequence:${src}`,
        kind: readTimelinePreviewMediaSourceKind(source),
        label: readTimelinePreviewMediaSourceLabel(source),
        openUrl: readVideoSequenceSourcePlayableUrl(source) || src,
        source,
        src,
      }]
    })
    return {
      exportPlan,
      items,
      previewPlan,
      sequenceMaxMinutes: Math.max(0, buildMermaidGanttTimelineModel(code).durationMinutes || 0),
    }
  }, [args.markdownDocumentName, args.markdownText, args.selectedRowKey])
}
