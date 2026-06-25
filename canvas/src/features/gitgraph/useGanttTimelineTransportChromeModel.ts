import React from 'react'
import { type VideoSequenceClipEditAction } from '@/components/timeline/VideoSequenceClipEditPanel'
import {
  buildVideoSequenceExportSessionCollection,
  type VideoSequenceExportKind,
  type VideoSequenceExportSessionRecord,
} from '@/components/timeline/videoSequenceExport'
import {
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import { type MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'

type ExportSessionCollection = ReturnType<typeof buildVideoSequenceExportSessionCollection>

export type GanttTimelineTransportChromeModel = {
  contextControls: {
    clipEdit: {
      disabled: boolean
      maxMinutes: number
      mediaDurationSeconds: number
      playheadMinutes: number
      selectedSpan: MermaidGanttTimelineTaskSpan | null
      onAction: (action: VideoSequenceClipEditAction) => void
    }
    exportSessions: {
      emptyLabel: string
      items: Array<{
        detailLabel: string
        message: string
        retryButtonLabel: string
        retryButtonTitle: string
        retryState: 'disabled' | 'ready'
        retryable: boolean
        runId: string
        status: string
        styleMode: string
        styleTone: string
        onRetry: () => void
      }>
    }
  }
  headerTools: {
    actionButtons: Array<{
      ariaLabel: string
      dataValue?: 'audio' | 'retry' | 'video'
      disabled: boolean
      icon: 'audio' | 'center' | 'download' | 'fit' | 'retry' | 'zoom-in' | 'zoom-out'
      key: 'audio' | 'center' | 'fit' | 'retry' | 'video' | 'zoom-in' | 'zoom-out'
      onClick: () => void
      title: string
    }>
    toolButtons: Array<{
      active: boolean
      disabled: boolean
      id: VideoSequenceTimelineToolId
      label: string
      onClick: () => void
      title: string
    }>
  }
}

export function useGanttTimelineTransportChromeModel(args: {
  canFitTimeline: boolean
  canZoomIn: boolean
  canZoomOut: boolean
  cancelEditedMediaExport: (kind?: VideoSequenceExportKind) => boolean
  centerTimelinePlayhead: () => void
  disabled: boolean
  exportPlanError: string
  exportSessionCollection: ExportSessionCollection
  exportingKind: VideoSequenceExportKind | ''
  handleDownloadEditedMedia: (kind: VideoSequenceExportKind) => Promise<void>
  handleRetryEditedMediaExport: (session: VideoSequenceExportSessionRecord | null | undefined) => Promise<boolean>
  handleRetryEditedMediaExportRunId: (runId: string) => Promise<boolean>
  handleVideoSequenceClipEdit: (action: VideoSequenceClipEditAction) => void
  handleVideoSequenceTool: (toolId: VideoSequenceTimelineToolId) => void
  handleFitTimeline: () => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  latestRetryableExportSession: VideoSequenceExportSessionRecord | null | undefined
  maxMinutes: number
  mediaDurationSeconds: number
  playheadMinutes: number
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  toolStatus: Record<VideoSequenceTimelineToolId, boolean>
}): GanttTimelineTransportChromeModel {
  return React.useMemo(() => {
    const videoExportBusy = args.exportingKind === 'video'
    const audioExportBusy = args.exportingKind === 'audio'
    const exportBusy = args.exportingKind !== ''
    const videoExportDisabled = args.disabled || !args.exportSessionCollection.plan || !!args.exportPlanError || (exportBusy && !videoExportBusy)
    const audioExportDisabled = args.disabled || !args.exportSessionCollection.plan || !!args.exportPlanError || (exportBusy && !audioExportBusy)

    return {
      contextControls: {
        clipEdit: {
          disabled: args.disabled,
          maxMinutes: args.maxMinutes,
          mediaDurationSeconds: args.mediaDurationSeconds,
          onAction: args.handleVideoSequenceClipEdit,
          playheadMinutes: args.playheadMinutes,
          selectedSpan: args.selectedSpan,
        },
        exportSessions: {
          emptyLabel: args.exportSessionCollection.surface.emptyLabel,
          items: args.exportSessionCollection.surface.items.map(session => ({
            detailLabel: session.detailLabel,
            message: session.message,
            onRetry: () => {
              void args.handleRetryEditedMediaExportRunId(session.runId)
            },
            retryButtonLabel: session.retryButtonLabel,
            retryButtonTitle: session.retryButtonTitle,
            retryState: session.retryable ? 'ready' : 'disabled',
            retryable: session.retryable,
            runId: session.runId,
            status: session.status,
            styleMode: session.styleMode,
            styleTone: session.styleTone,
          })),
        },
      },
      headerTools: {
        actionButtons: [
          {
            ariaLabel: videoExportBusy ? 'Cancel edited video export' : 'Download edited video',
            dataValue: 'video',
            disabled: videoExportDisabled,
            icon: 'download',
            key: 'video',
            onClick: () => {
              void (videoExportBusy ? args.cancelEditedMediaExport('video') : args.handleDownloadEditedMedia('video'))
            },
            title: videoExportBusy ? 'Cancel edited video export' : (args.exportPlanError || 'Download edited video'),
          },
          {
            ariaLabel: audioExportBusy ? 'Cancel edited audio export' : 'Download edited audio',
            dataValue: 'audio',
            disabled: audioExportDisabled,
            icon: 'audio',
            key: 'audio',
            onClick: () => {
              void (audioExportBusy ? args.cancelEditedMediaExport('audio') : args.handleDownloadEditedMedia('audio'))
            },
            title: audioExportBusy ? 'Cancel edited audio export' : (args.exportPlanError || 'Download edited audio'),
          },
          {
            ariaLabel: args.exportSessionCollection.retryControl.ariaLabel,
            dataValue: 'retry',
            disabled: args.exportSessionCollection.retryControl.disabled,
            icon: 'retry',
            key: 'retry',
            onClick: () => {
              void args.handleRetryEditedMediaExport(args.latestRetryableExportSession)
            },
            title: args.exportSessionCollection.retryControl.title,
          },
          {
            ariaLabel: 'Zoom out Gantt timeline',
            disabled: args.disabled || !args.canZoomOut,
            icon: 'zoom-out',
            key: 'zoom-out',
            onClick: args.handleZoomOut,
            title: 'Zoom out',
          },
          {
            ariaLabel: 'Zoom in Gantt timeline',
            disabled: args.disabled || !args.canZoomIn,
            icon: 'zoom-in',
            key: 'zoom-in',
            onClick: args.handleZoomIn,
            title: 'Zoom in',
          },
          {
            ariaLabel: 'Fit full Gantt timeline',
            disabled: args.disabled || !args.canFitTimeline,
            icon: 'fit',
            key: 'fit',
            onClick: args.handleFitTimeline,
            title: 'Fit timeline',
          },
          {
            ariaLabel: 'Center Gantt playhead',
            disabled: args.disabled,
            icon: 'center',
            key: 'center',
            onClick: args.centerTimelinePlayhead,
            title: 'Center playhead',
          },
        ],
        toolButtons: VIDEO_SEQUENCE_TIMELINE_TOOLS.map(tool => ({
          active: args.toolStatus[tool.id],
          disabled: args.disabled || !args.toolStatus[tool.id],
          id: tool.id,
          label: tool.label,
          onClick: () => args.handleVideoSequenceTool(tool.id),
          title: tool.title,
        })),
      },
    }
  }, [
    args.canFitTimeline,
    args.canZoomIn,
    args.canZoomOut,
    args.cancelEditedMediaExport,
    args.centerTimelinePlayhead,
    args.disabled,
    args.exportPlanError,
    args.exportSessionCollection.plan,
    args.exportSessionCollection.retryControl.ariaLabel,
    args.exportSessionCollection.retryControl.disabled,
    args.exportSessionCollection.retryControl.title,
    args.exportSessionCollection.surface.emptyLabel,
    args.exportSessionCollection.surface.items,
    args.exportingKind,
    args.handleDownloadEditedMedia,
    args.handleFitTimeline,
    args.handleRetryEditedMediaExport,
    args.handleRetryEditedMediaExportRunId,
    args.handleVideoSequenceClipEdit,
    args.handleVideoSequenceTool,
    args.handleZoomIn,
    args.handleZoomOut,
    args.latestRetryableExportSession,
    args.maxMinutes,
    args.mediaDurationSeconds,
    args.playheadMinutes,
    args.selectedSpan,
    args.toolStatus,
  ])
}
