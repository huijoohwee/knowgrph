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
    || 'Video source'
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
