import React from 'react'
import { useTimelineMediaReaderSummary } from '@/components/timeline/timelineMediaReader'
import { buildTimelineAnimationState } from '@/components/timeline/timelineAnimationEngine'
import { resolveTimelinePlanSourceUrl } from '@/components/timeline/timelinePlanSync'
import { readVideoSequenceTimelineModelFromMarkdown } from '@/components/timeline/videoSequenceTimeline'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MermaidDiagramPanelView } from './MermaidDiagramPanelView'
import { useFlowEditorDiagramSelectionBridge } from './useFlowEditorDiagramSelectionBridge'
import { useMermaidGanttDocument } from './useMermaidGanttDocument'
import { useMermaidTimelineDocument } from './useMermaidTimelineDocument'

export function TimelineFloatingPanelView() {
  const markdownDocumentText = useGraphStore(state => state.markdownDocumentText)
  const { code: timelineCode, graphData, themeMode, timelineModel } = useMermaidTimelineDocument()
  const { code: ganttCode, ganttModel, themeMode: ganttThemeMode } = useMermaidGanttDocument()
  const mediaMetadataSourceUrl = React.useMemo(() => {
    const source = readVideoSequenceTimelineModelFromMarkdown(markdownDocumentText)?.sources.find(candidate => resolveTimelinePlanSourceUrl(candidate))
    return source ? resolveTimelinePlanSourceUrl(source) : ''
  }, [markdownDocumentText])
  const mediaReaderSummary = useTimelineMediaReaderSummary({
    active: !!mediaMetadataSourceUrl,
    url: mediaMetadataSourceUrl,
  })
  const metadataAttrs = {
    'data-kg-timeline-floating-panel-media-metadata': mediaMetadataSourceUrl ? mediaReaderSummary.status : undefined,
    'data-kg-timeline-floating-panel-media-metadata-byte-size': mediaReaderSummary.byteSize > 0 ? mediaReaderSummary.byteSize : undefined,
    'data-kg-timeline-floating-panel-media-metadata-bytes-read': mediaReaderSummary.bytesRead > 0 ? mediaReaderSummary.bytesRead : undefined,
    'data-kg-timeline-floating-panel-media-metadata-duration': mediaReaderSummary.durationSeconds > 0 ? mediaReaderSummary.durationSeconds : undefined,
    'data-kg-timeline-floating-panel-media-metadata-format': mediaReaderSummary.formatName || undefined,
    'data-kg-timeline-floating-panel-media-metadata-mime-type': mediaReaderSummary.mimeType || undefined,
    'data-kg-timeline-floating-panel-media-metadata-resolution': mediaReaderSummary.displayWidth > 0 && mediaReaderSummary.displayHeight > 0 ? `${mediaReaderSummary.displayWidth}x${mediaReaderSummary.displayHeight}` : undefined,
    'data-kg-timeline-floating-panel-media-metadata-video-codec': mediaReaderSummary.primaryVideoCodec || undefined,
  } as React.HTMLAttributes<HTMLElement>
  const animationState = React.useMemo(() => buildTimelineAnimationState({
    active: !!timelineCode || !!ganttCode,
    itemCount: timelineModel.rows.length || ganttModel.rows.length,
    progress: mediaReaderSummary.metadataReadRatio || 0,
    surface: 'floating-timeline',
  }), [ganttCode, ganttModel.rows.length, mediaReaderSummary.metadataReadRatio, timelineCode, timelineModel.rows.length])
  const { style: animationStyle, ...animationAttributes } = animationState.attributes
  const { handleDiagramSelectedRowKeyChange } = useFlowEditorDiagramSelectionBridge({
    graphData,
    diagramModel: timelineModel,
    kind: 'timeline',
  })
  if (!timelineCode && ganttCode) {
    return (
      <section className="h-full min-h-0" data-kg-timeline-floating-panel="1" {...metadataAttrs} {...animationAttributes} style={animationStyle}>
        <MermaidDiagramPanelView
          code={ganttCode}
          model={ganttModel}
          kind="gantt"
          title="Gantt-Timeline"
          emptyLabel="No Gantt-Timeline Mermaid frontmatter."
          rootThemeMode={ganttThemeMode}
          surface="floatingPanel"
          renderMode="list"
        />
      </section>
    )
  }
  return (
    <section className="h-full min-h-0" data-kg-timeline-floating-panel="1" {...metadataAttrs} {...animationAttributes} style={animationStyle}>
      <MermaidDiagramPanelView
        code={timelineCode}
        model={timelineModel}
        kind="timeline"
        title="Timeline"
        emptyLabel="No Timeline Mermaid frontmatter."
        rootThemeMode={themeMode}
        surface="floatingPanel"
        renderMode="list"
        onSelectedRowKeyChange={handleDiagramSelectedRowKeyChange}
      />
    </section>
  )
}
