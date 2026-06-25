import { useGanttTimelineDocumentActions } from './useGanttTimelineDocumentActions'
import type { MermaidGanttTimelineTaskSpan } from '@/lib/mermaid/mermaidGanttBarInteraction'
import type { VideoSequenceExportPlan } from '@/components/timeline/videoSequenceExport'

export type GanttTimelineTransportCommandModel = {
  chromeModelCommands: Pick<
    ReturnType<typeof useGanttTimelineDocumentActions>,
    | 'cancelEditedMediaExport'
    | 'exportSessionCollection'
    | 'exportingKind'
    | 'handleDownloadEditedMedia'
    | 'handleRetryEditedMediaExport'
    | 'handleRetryEditedMediaExportRunId'
    | 'handleVideoSequenceClipEdit'
    | 'handleVideoSequenceTool'
    | 'latestRetryableExportSession'
  >
  handleCommittedDragUpdate: ReturnType<typeof useGanttTimelineDocumentActions>['handleCommittedDragUpdate']
}

export function useGanttTimelineTransportCommandModel(args: {
  code: string
  exportPlan: VideoSequenceExportPlan | null
  markdownDocumentName: string
  markdownText: string
  maxMinutes: number
  positionMinutes: number
  selectedSpan: MermaidGanttTimelineTaskSpan | null
  setSelectedRowKey: (rowKey: string) => void
  setTransportPlaying: (nextPlaying: boolean) => void
}): GanttTimelineTransportCommandModel {
  const documentActions = useGanttTimelineDocumentActions({
    code: args.code,
    exportPlan: args.exportPlan,
    markdownDocumentName: args.markdownDocumentName,
    markdownText: args.markdownText,
    maxMinutes: args.maxMinutes,
    positionMinutes: args.positionMinutes,
    selectedSpan: args.selectedSpan,
    setSelectedRowKey: args.setSelectedRowKey,
    setTransportPlaying: args.setTransportPlaying,
  })

  return {
    chromeModelCommands: {
      cancelEditedMediaExport: documentActions.cancelEditedMediaExport,
      exportSessionCollection: documentActions.exportSessionCollection,
      exportingKind: documentActions.exportingKind,
      handleDownloadEditedMedia: documentActions.handleDownloadEditedMedia,
      handleRetryEditedMediaExport: documentActions.handleRetryEditedMediaExport,
      handleRetryEditedMediaExportRunId: documentActions.handleRetryEditedMediaExportRunId,
      handleVideoSequenceClipEdit: documentActions.handleVideoSequenceClipEdit,
      handleVideoSequenceTool: documentActions.handleVideoSequenceTool,
      latestRetryableExportSession: documentActions.latestRetryableExportSession,
    },
    handleCommittedDragUpdate: documentActions.handleCommittedDragUpdate,
  }
}
