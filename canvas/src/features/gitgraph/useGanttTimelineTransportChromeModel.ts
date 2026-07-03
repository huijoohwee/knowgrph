import React from 'react'
import {
  buildVideoSequenceClipEditDetailsLabel,
  normalizeVideoSequenceClipEditDeltaMinutes,
  resolveVideoSequenceClipEditStepMinutes,
  type VideoSequenceClipEditAction,
} from '@/components/timeline/videoSequenceClipEdit'
import {
  buildVideoSequenceExportSessionCollection,
  type VideoSequenceExportKind,
  type VideoSequenceExportSessionRecord,
} from '@/components/timeline/videoSequenceExport'
import {
  VIDEO_SEQUENCE_TIMELINE_TOOLS,
  shouldUseTimelineSecondsForVideoSequenceClipEdit,
  type VideoSequenceTimelineToolId,
} from '@/components/timeline/videoSequenceTimeline'
import { type MermaidGanttTimelineTaskSpan, type MermaidGanttVideoSequenceTimingSyncMode } from '@/lib/mermaid/mermaidGanttBarInteraction'

type ExportSessionCollection = ReturnType<typeof buildVideoSequenceExportSessionCollection>

export type GanttTimelineTransportChromeModel = {
  contextControls: {
    clipEdit: {
      detailsLabel: string
      maxMinutes: number
      mediaDurationSeconds: number
      selectedSpan: MermaidGanttTimelineTaskSpan | null
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
    syncModeButton: {
      active: boolean
      ariaLabel: string
      disabled: boolean
      mode: MermaidGanttVideoSequenceTimingSyncMode
      onClick: () => void
      title: string
    }
    clipActionButtons: Array<{
      action: VideoSequenceClipEditAction
      active?: boolean
      ariaLabel: string
      disabled: boolean
      icon: 'bookmark' | 'delete' | 'duplicate' | 'extract-audio' | 'nudge-back' | 'nudge-forward' | 'ripple' | 'snap' | 'snapping' | 'split' | 'split-right' | 'trim-end-back' | 'trim-end-forward' | 'trim-start-back' | 'trim-start-forward'
      key: VideoSequenceClipEditAction
      label: string
      onClick: () => void
      title: string
    }>
    actionButtons: Array<{
      ariaLabel: string
      dataValue?: 'audio' | 'retry' | 'video'
      disabled: boolean
      icon: 'audio' | 'download' | 'retry'
      key: 'audio' | 'retry' | 'video'
      onClick: () => void
      title: string
    }>
    zoomControls: {
      label: string
      percent: number
      actionButtons: Array<{
        ariaLabel: string
        disabled: boolean
        icon: 'center' | 'fit' | 'zoom-in' | 'zoom-out'
        key: 'center' | 'fit' | 'zoom-in' | 'zoom-out'
        onClick: () => void
        title: string
      }>
    }
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
  autoSnappingEnabled: boolean
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
  handleToggleVideoSequenceTimingSyncMode: () => void
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
  rippleEditingEnabled: boolean
  timelineZoom: number
  timelineZoomPercent: number
  timingSyncMode: MermaidGanttVideoSequenceTimingSyncMode
  toolStatus: Record<VideoSequenceTimelineToolId, boolean>
}): GanttTimelineTransportChromeModel {
  return React.useMemo(() => {
    const videoExportBusy = args.exportingKind === 'video'
    const audioExportBusy = args.exportingKind === 'audio'
    const exportBusy = args.exportingKind !== ''
    const videoExportDisabled = args.disabled || !args.exportSessionCollection.plan || !!args.exportPlanError || (exportBusy && !videoExportBusy)
    const audioExportDisabled = args.disabled || !args.exportSessionCollection.plan || !!args.exportPlanError || (exportBusy && !audioExportBusy)
    const selectedSpan = args.selectedSpan
    const clipActionDisabled = args.disabled || !selectedSpan
    const clipEditStepMinutes = resolveVideoSequenceClipEditStepMinutes(selectedSpan)
    const selectedDurationMinutes = selectedSpan?.durationMinutes || 0
    const roundedPlayheadDelta = selectedSpan
      ? normalizeVideoSequenceClipEditDeltaMinutes(args.playheadMinutes - selectedSpan.startMinutes, clipEditStepMinutes)
      : 0
    const playheadInsideSelection = Boolean(
      selectedSpan &&
        args.playheadMinutes > selectedSpan.startMinutes &&
        args.playheadMinutes < selectedSpan.endMinutes,
    )

    return {
      contextControls: {
        clipEdit: {
          detailsLabel: buildVideoSequenceClipEditDetailsLabel({
            maxMinutes: args.maxMinutes,
            mediaDurationSeconds: args.mediaDurationSeconds,
            selectedSpan,
            useTimelineSeconds: shouldUseTimelineSecondsForVideoSequenceClipEdit(selectedSpan),
          }),
          maxMinutes: args.maxMinutes,
          mediaDurationSeconds: args.mediaDurationSeconds,
          selectedSpan,
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
        syncModeButton: {
          active: args.timingSyncMode === 'grouped',
          ariaLabel: args.timingSyncMode === 'grouped' ? 'Ungroup video and audio timing sync' : 'Group video and audio timing sync',
          disabled: args.disabled,
          mode: args.timingSyncMode,
          onClick: args.handleToggleVideoSequenceTimingSyncMode,
          title: args.timingSyncMode === 'grouped'
            ? 'Timing sync grouped: click to ungroup video/audio lanes'
            : 'Timing sync ungrouped: click to group video/audio lanes',
        },
        clipActionButtons: [
          {
            action: 'add-bookmark',
            ariaLabel: 'Add bookmark at the playhead',
            disabled: clipActionDisabled,
            icon: 'bookmark',
            key: 'add-bookmark',
            label: 'Bookmark',
            onClick: () => args.handleVideoSequenceClipEdit('add-bookmark'),
            title: 'Add bookmark at the playhead',
          },
          {
            action: 'toggle-auto-snapping',
            active: args.autoSnappingEnabled,
            ariaLabel: args.autoSnappingEnabled ? 'Disable auto snapping' : 'Enable auto snapping',
            disabled: args.disabled,
            icon: 'snapping',
            key: 'toggle-auto-snapping',
            label: 'Snap',
            onClick: () => args.handleVideoSequenceClipEdit('toggle-auto-snapping'),
            title: args.autoSnappingEnabled ? 'Auto snapping on' : 'Auto snapping off',
          },
          {
            action: 'toggle-ripple-editing',
            active: args.rippleEditingEnabled,
            ariaLabel: args.rippleEditingEnabled ? 'Disable ripple editing' : 'Enable ripple editing',
            disabled: args.disabled,
            icon: 'ripple',
            key: 'toggle-ripple-editing',
            label: 'Ripple',
            onClick: () => args.handleVideoSequenceClipEdit('toggle-ripple-editing'),
            title: args.rippleEditingEnabled ? 'Ripple editing on' : 'Ripple editing off',
          },
          {
            action: 'nudge-back',
            ariaLabel: 'Move selected clip left by one edit step',
            disabled: clipActionDisabled || (selectedSpan?.startMinutes || 0) <= 0,
            icon: 'nudge-back',
            key: 'nudge-back',
            label: '-1',
            onClick: () => args.handleVideoSequenceClipEdit('nudge-back'),
            title: 'Move selected clip left by one edit step',
          },
          {
            action: 'nudge-forward',
            ariaLabel: 'Move selected clip right by one edit step',
            disabled: clipActionDisabled,
            icon: 'nudge-forward',
            key: 'nudge-forward',
            label: '+1',
            onClick: () => args.handleVideoSequenceClipEdit('nudge-forward'),
            title: 'Move selected clip right by one edit step',
          },
          {
            action: 'trim-start-back',
            ariaLabel: 'Extend selected clip start left by one edit step',
            disabled: clipActionDisabled || (selectedSpan?.startMinutes || 0) <= 0,
            icon: 'trim-start-back',
            key: 'trim-start-back',
            label: 'In -1',
            onClick: () => args.handleVideoSequenceClipEdit('trim-start-back'),
            title: 'Extend selected clip start left by one edit step',
          },
          {
            action: 'trim-start-forward',
            ariaLabel: 'Trim selected clip start right by one edit step',
            disabled: clipActionDisabled || selectedDurationMinutes <= clipEditStepMinutes,
            icon: 'trim-start-forward',
            key: 'trim-start-forward',
            label: 'In +1',
            onClick: () => args.handleVideoSequenceClipEdit('trim-start-forward'),
            title: 'Trim selected clip start right by one edit step',
          },
          {
            action: 'trim-end-back',
            ariaLabel: 'Trim selected clip end left by one edit step',
            disabled: clipActionDisabled || selectedDurationMinutes <= clipEditStepMinutes,
            icon: 'trim-end-back',
            key: 'trim-end-back',
            label: 'Out -1',
            onClick: () => args.handleVideoSequenceClipEdit('trim-end-back'),
            title: 'Trim selected clip end left by one edit step',
          },
          {
            action: 'trim-end-forward',
            ariaLabel: 'Extend selected clip end right by one edit step',
            disabled: clipActionDisabled,
            icon: 'trim-end-forward',
            key: 'trim-end-forward',
            label: 'Out +1',
            onClick: () => args.handleVideoSequenceClipEdit('trim-end-forward'),
            title: 'Extend selected clip end right by one edit step',
          },
          {
            action: 'snap-to-playhead',
            ariaLabel: 'Move selected clip start to the playhead',
            disabled: clipActionDisabled || roundedPlayheadDelta === 0,
            icon: 'snap',
            key: 'snap-to-playhead',
            label: 'Snap',
            onClick: () => args.handleVideoSequenceClipEdit('snap-to-playhead'),
            title: 'Move selected clip start to the playhead',
          },
          {
            action: 'split-at-playhead',
            ariaLabel: 'Split selected clip group at the playhead',
            disabled: clipActionDisabled || !playheadInsideSelection,
            icon: 'split',
            key: 'split-at-playhead',
            label: 'Split',
            onClick: () => args.handleVideoSequenceClipEdit('split-at-playhead'),
            title: 'Split selected clip group at the playhead',
          },
          {
            action: 'split-right-at-playhead',
            ariaLabel: 'Split right side of selected clip at the playhead',
            disabled: clipActionDisabled || !playheadInsideSelection,
            icon: 'split-right',
            key: 'split-right-at-playhead',
            label: 'Right',
            onClick: () => args.handleVideoSequenceClipEdit('split-right-at-playhead'),
            title: 'Split right side of selected clip at the playhead',
          },
          {
            action: 'extract-audio',
            ariaLabel: 'Extract selected clip audio to a source-backed audio lane',
            disabled: clipActionDisabled,
            icon: 'extract-audio',
            key: 'extract-audio',
            label: 'Audio',
            onClick: () => args.handleVideoSequenceClipEdit('extract-audio'),
            title: 'Extract selected clip audio to a source-backed audio lane',
          },
          {
            action: 'duplicate-element',
            ariaLabel: 'Duplicate selected clip element',
            disabled: clipActionDisabled,
            icon: 'duplicate',
            key: 'duplicate-element',
            label: 'Copy',
            onClick: () => args.handleVideoSequenceClipEdit('duplicate-element'),
            title: 'Duplicate selected clip element',
          },
          {
            action: 'delete-element',
            ariaLabel: 'Delete selected clip element',
            disabled: clipActionDisabled,
            icon: 'delete',
            key: 'delete-element',
            label: 'Delete',
            onClick: () => args.handleVideoSequenceClipEdit('delete-element'),
            title: 'Delete selected clip element',
          },
        ],
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
        ],
        zoomControls: {
          label: `${Math.round(args.timelineZoom * 100)}%`,
          percent: Math.max(0, Math.min(100, args.timelineZoomPercent)),
          actionButtons: [
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
        },
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
    args.autoSnappingEnabled,
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
    args.handleToggleVideoSequenceTimingSyncMode,
    args.handleVideoSequenceClipEdit,
    args.handleVideoSequenceTool,
    args.handleZoomIn,
    args.handleZoomOut,
    args.latestRetryableExportSession,
    args.maxMinutes,
    args.mediaDurationSeconds,
    args.playheadMinutes,
    args.rippleEditingEnabled,
    args.selectedSpan,
    args.timelineZoom,
    args.timelineZoomPercent,
    args.timingSyncMode,
    args.toolStatus,
  ])
}
