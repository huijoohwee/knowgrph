import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildVideoSequenceTimelineCueSamples,
  buildVideoSequenceTimelineFrameSamples,
  buildVideoSequenceTimelineScopes,
  buildVideoSequenceTimelineWaveformSamples,
  formatVideoSequenceTimelineSecondsOffset,
  resolveVideoSequenceTimelineMediaSeconds,
  resolveVideoSequenceTimelinePositionMinutes,
  resolveVideoSequenceTimelineUnitsPerMs,
  resolveVisibleVideoSequenceTimelineLaneCount,
  resolveVisibleVideoSequenceTimelineLanes,
  type VideoSequenceTimelineSource,
} from '@/components/timeline/videoSequenceTimeline'
import {
  areVideoSequenceExportSourcesEqual,
  buildVideoSequenceExportPlan,
} from '@/components/timeline/videoSequenceExport'
import {
  buildTimelinePreviewSyncPlan,
  resolveTimelinePlanSegmentAtPosition,
  resolveTimelinePlanPositionFromSourceTime,
  resolveTimelinePlanSourceTimeAtPosition,
} from '@/components/timeline/timelinePlanSync'
import {
  buildMermaidGanttTimelineModel,
  insertMermaidGanttVideoSequenceOperationRow,
  resolveMermaidGanttTimelineDragEffectiveDelta,
  resolveMermaidGanttTimelineDragPreviewSpan,
  updateMermaidGanttCodeRowTiming,
} from '@/lib/mermaid/mermaidGanttBarInteraction'

const root = process.cwd()

function readSource(...parts: string[]): string {
  return readFileSync(resolve(root, 'src', ...parts), 'utf8')
}

export function testVideoSequenceTimelineSurfacesAreRuntimeReady() {
  const controlsText = readSource('components', 'timeline', 'TimelineTransportControls.tsx')
  const controlsCssText = readSource('components', 'timeline', 'TimelineTransportControls.css')
  const clipEditText = readSource('components', 'timeline', 'VideoSequenceClipEditPanel.tsx')
  const clipEditCssText = readSource('components', 'timeline', 'VideoSequenceClipEditPanel.css')
  const mediaCanvasText = readSource('components', 'MediaCanvas.tsx')
  const previewMediaCanvasBindingText = readSource('components', 'timeline', 'useTimelinePreviewMediaCanvasBinding.ts')
  const previewBootstrapText = readSource('components', 'timeline', 'useTimelinePreviewBootstrap.ts')
  const previewRouteEntryText = readSource('components', 'timeline', 'useTimelinePreviewRouteEntry.ts')
  const previewCollectionText = readSource('components', 'timeline', 'useTimelinePreviewCollection.ts')
  const previewActivitySurfaceModelText = readSource('components', 'timeline', 'useTimelinePreviewActivitySurfaceModel.ts')
  const previewFamilyCompactionModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilyCompactionModel.ts')
  const previewFamilyDisclosureControllerText = readSource('components', 'timeline', 'useTimelinePreviewFamilyDisclosureController.ts')
  const previewFamilyDisclosureModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilyDisclosureModel.ts')
  const previewFamilyDisclosureSurfaceModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilyDisclosureSurfaceModel.ts')
  const previewFamilySectionLayoutModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilySectionLayoutModel.ts')
  const previewFamilySectionChromeModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilySectionChromeModel.ts')
  const previewFamilySectionBodyModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilySectionBodyModel.ts')
  const previewFamilySectionsModelText = readSource('components', 'timeline', 'useTimelinePreviewFamilySectionsModel.ts')
  const previewMediaContextText = readSource('components', 'timeline', 'useTimelinePreviewMediaContext.ts')
  const previewScopeProjectionText = readSource('components', 'timeline', 'useTimelinePreviewScopeProjection.ts')
  const previewMonitorContextText = readSource('components', 'timeline', 'useTimelinePreviewMonitorContext.ts')
  const previewMonitorBindingText = readSource('components', 'timeline', 'useTimelinePreviewMonitorBinding.ts')
  const previewMediaCanvasRenderModelText = readSource('components', 'timeline', 'useTimelinePreviewMediaCanvasRenderModel.ts')
  const previewMediaCanvasRenderText = readSource('components', 'timeline', 'TimelinePreviewMediaCanvasRender.tsx')
  const previewMediaCanvasFrameModelText = readSource('components', 'timeline', 'useTimelinePreviewMediaCanvasFrameModel.ts')
  const previewMediaCanvasFrameText = readSource('components', 'timeline', 'TimelinePreviewMediaCanvasFrame.tsx')
  const previewSurfaceShellModelText = readSource('components', 'timeline', 'useTimelinePreviewSurfaceShellModel.ts')
  const timelineSourceActivityModelText = readSource('components', 'timeline', 'useTimelineSourceActivityModel.ts')
  const previewSurfaceModelText = readSource('components', 'timeline', 'useTimelinePreviewSurfaceModel.ts')
  const previewSurfaceText = readSource('components', 'timeline', 'TimelinePreviewSurface.tsx')
  const previewSyncText = readSource('components', 'timeline', 'timelinePreviewSync.ts')
  const previewVideoBindingText = readSource('components', 'timeline', 'useTimelinePreviewVideoBinding.ts')
  const rulerText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.tsx')
  const rulerCssText = readSource('components', 'timeline', 'VideoSequenceTimelineRuler.css')
  const transportPanelText = readSource('features', 'gitgraph', 'GanttTimelineTransportPanel.tsx')
  const transportRouteModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportRouteModel.ts')
  const transportSurfaceModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportSurfaceModel.ts')
  const transportSurfaceText = readSource('features', 'gitgraph', 'GanttTimelineTransportSurface.tsx')
  const transportCommandModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportCommandModel.ts')
  const transportChromeModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportChromeModel.ts')
  const transportContextControlsText = readSource('features', 'gitgraph', 'GanttTimelineTransportContextControls.tsx')
  const transportHeaderToolsText = readSource('features', 'gitgraph', 'GanttTimelineTransportHeaderTools.tsx')
  const transportRulerModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportRulerModel.ts')
  const transportRulerText = readSource('features', 'gitgraph', 'GanttTimelineTransportRuler.tsx')
  const transportInteractionModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportInteractionModel.ts')
  const transportShellModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportShellModel.ts')
  const transportShellText = readSource('features', 'gitgraph', 'GanttTimelineTransportShell.tsx')
  const transportPlaybackModelText = readSource('features', 'gitgraph', 'useGanttTimelineTransportPlaybackModel.ts')
  const transportPreviewSessionText = readSource('features', 'gitgraph', 'useGanttTimelineTransportPreviewSession.ts')
  const transportSessionText = readSource('features', 'gitgraph', 'useGanttTimelineTransportSession.ts')
  const displayModelText = readSource('features', 'gitgraph', 'useGanttTimelineDisplayModel.ts')
  const mediaDurationText = readSource('features', 'gitgraph', 'useGanttTimelineMediaDuration.ts')
  const playbackControlsText = readSource('features', 'gitgraph', 'useGanttTimelinePlaybackControls.ts')
  const selectionSyncText = readSource('features', 'gitgraph', 'useGanttTimelineSelectionSync.ts')
  const sequenceText = readSource('components', 'timeline', 'videoSequenceTimeline.ts')
  if (
    controlsText.includes('footer?: React.ReactNode') ||
    controlsText.includes('{footer}') ||
    !controlsText.includes('contextControls?: React.ReactNode') ||
    controlsText.includes('rulerAside?: React.ReactNode') ||
    controlsText.includes('rulerBelow?: React.ReactNode') ||
    controlsText.includes('timeline-transport-ruler-aside') ||
    controlsText.includes('timeline-transport-ruler-below') ||
    !controlsText.includes('timeline-player-context') ||
    !controlsText.includes('showInlineProgress?: boolean') ||
    !controlsText.includes('!showRange && showInlineProgress') ||
    !controlsText.includes('onPlaybackPointerDown') ||
    !controlsCssText.includes('.timeline-player-progress::-webkit-progress-value') ||
    !controlsCssText.includes('.timeline-transport-chrome--mermaid-gantt .timeline-player-progress') ||
    !controlsCssText.includes('min-height: calc(76px + (var(--kg-video-sequence-lane-count, 4) * 36px))') ||
    !controlsCssText.includes('line-height: 36px') ||
    controlsCssText.includes('.timeline-transport-ruler-layout:has(.timeline-transport-ruler-aside)') ||
    controlsCssText.includes('.timeline-transport-ruler-below') ||
    !clipEditText.includes('VideoSequenceClipEditPanel') ||
    !clipEditText.includes("data-kg-video-sequence-clip-edit") ||
    !clipEditText.includes('data-kg-video-sequence-clip-edit-surface="transport"') ||
    !clipEditText.includes("'split-at-playhead'") ||
    !clipEditText.includes("'snap-to-playhead'") ||
    !clipEditCssText.includes('.timeline-video-sequence-clip-edit-actions') ||
    !controlsText.includes('{contextControls}') ||
    !rulerText.includes('VideoSequenceTimelineRuler') ||
    !rulerText.includes('TimelineVideoSequenceEmptyState') ||
    !rulerText.includes('data-kg-video-sequence-clip-cues="1"') ||
    !rulerText.includes('data-kg-video-sequence-clip-frames="1"') ||
    !rulerText.includes('data-kg-video-sequence-audio-waveform="1"') ||
    !rulerText.includes('data-kg-video-sequence-ruler-scopes="1"') ||
    !rulerText.includes('data-kg-video-sequence-scope-active-family') ||
    !rulerText.includes('data-kg-video-sequence-scope-activity-mode') ||
    !rulerText.includes('data-kg-video-sequence-scope-selection-active') ||
    !rulerText.includes('timeline-video-sequence-ruler-scope-strip') ||
    !rulerText.includes('timeline-video-sequence-ruler-scope-bars') ||
    rulerText.includes('timeline-video-sequence-ruler-scope-header') ||
    rulerText.includes('<meter') ||
    !rulerText.includes('VIDEO_SEQUENCE_LANE_HEIGHT_PX = 36') ||
    !rulerText.includes('resolveVisibleVideoSequenceTimelineLanes(taskSpans)') ||
    !rulerText.includes('visibleLanes.map(lane =>') ||
    !rulerText.includes('visibleLaneIndexById.get(lane)') ||
    !rulerText.includes('buildVideoSequenceTimelineCueSamples') ||
    !rulerText.includes('buildVideoSequenceTimelineFrameSamples') ||
    !rulerText.includes('buildVideoSequenceTimelineWaveformSamples') ||
    !rulerText.includes('timeline-video-sequence-clip-timecode') ||
    !rulerText.includes('VIDEO_SEQUENCE_LANE_TOP_OFFSET_PX + laneIndex * VIDEO_SEQUENCE_LANE_HEIGHT_PX') ||
    !rulerCssText.includes('.timeline-transport-shell--video-sequence') ||
    !rulerCssText.includes('.timeline-transport-track-clip--lane-effect') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-content .timeline-transport-track-clip-move') ||
    !rulerCssText.includes('inset: 0 8px') ||
    !rulerCssText.includes('touch-action: none') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-content .timeline-transport-track-handle') ||
    !rulerCssText.includes('z-index: 3') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-frame-strip') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-frame') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-cues') ||
    !rulerCssText.includes('.timeline-video-sequence-clip-timecode') ||
    !rulerCssText.includes('.timeline-video-sequence-audio-waveform-bar') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-scope-strip') ||
    rulerCssText.includes('.timeline-video-sequence-ruler-scope-header') ||
    !rulerCssText.includes('height: 32px') ||
    !rulerCssText.includes('top: calc(24px + (var(--kg-video-sequence-lane-count, 11) * 36px) + 2px)') ||
    !rulerCssText.includes('grid-template-columns: repeat(6, minmax(5.5rem, 1fr))') ||
    !rulerCssText.includes('.timeline-video-sequence-ruler-scope-bar') ||
    rulerCssText.includes('.timeline-video-sequence-slot-grid') ||
    !sequenceText.includes('Luma waveform') ||
    !sequenceText.includes('Chroma vectorscope') ||
    !sequenceText.includes('Histogram') ||
    !sequenceText.includes('Audio waveform') ||
    !sequenceText.includes('buildVideoSequenceTimelineCueSamples') ||
    !sequenceText.includes('buildVideoSequenceTimelineFrameSamples') ||
    !sequenceText.includes('buildVideoSequenceTimelineWaveformSamples') ||
    !sequenceText.includes('TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT') ||
    !sequenceText.includes("export type VideoSequenceTimelineToolId = 'cut' | 'splice' | 'mask' | 'grade' | 'speed' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'effect'") ||
    !sequenceText.includes("export type VideoSequenceTimelineLaneId = 'video' | 'image' | 'scene' | 'mask' | 'grade' | 'effect' | 'adjustment' | 'transition' | 'keyframe' | 'filter' | 'audio'") ||
    !sequenceText.includes('VIDEO_SEQUENCE_TIMELINE_OPERATION_TOOL_IDS') ||
    !transportPanelText.includes('useGanttTimelineTransportRouteModel') ||
    !transportPanelText.includes('GanttTimelineTransportSurface') ||
    transportPanelText.includes('useGanttTimelineTransportSurfaceModel') ||
    transportPanelText.includes('useGanttTimelineTransportSession') ||
    transportPanelText.includes('useGanttTimelineTransportCommandModel') ||
    transportPanelText.includes('useGanttTimelineTransportPlaybackModel') ||
    transportPanelText.includes('useGanttTimelineTransportInteractionModel') ||
    transportPanelText.includes('useGanttTimelineTransportChromeModel') ||
    transportPanelText.includes('useGanttTimelineTransportRulerModel') ||
    transportPanelText.includes('useGanttTimelineTransportShellModel') ||
    transportPanelText.includes('useGanttTimelineDocumentActions') ||
    transportPanelText.includes('useGanttTimelineInteractions') ||
    transportPanelText.includes('useGanttTimelineSelectionSync') ||
    transportPanelText.includes('useGanttTimelineTransportView') ||
    transportPanelText.includes('resolveMermaidGanttTimelineRowKeyAtPosition') ||
    transportPanelText.includes('handleVideoSequenceClipEdit') ||
    transportPanelText.includes('showInlineProgress={false}') ||
    transportPanelText.includes('contextControls={<GanttTimelineTransportContextControls') ||
    transportPanelText.includes('headerAside={<GanttTimelineTransportHeaderTools') ||
    transportPanelText.includes('ruler={<GanttTimelineTransportRuler') ||
    transportPanelText.includes('rulerAside={(') ||
    transportPanelText.includes('rulerBelow={(') ||
    transportPanelText.includes('VideoSequenceClipEditPanel') ||
    transportPanelText.includes('VideoSequenceMonitorPanel') ||
    transportPanelText.includes('VideoSequenceTimelineRuler') ||
    transportPanelText.includes('scopes={monitorScopes}') ||
    transportPanelText.includes('<TimelineTransportChrome') ||
    transportPanelText.includes('useGanttTimelinePlaybackControls') ||
    transportPanelText.includes('useTimelineTransportPlayback({') ||
    transportPanelText.includes('useTimelinePreviewMonitorBinding') ||
    transportPanelText.includes('useTimelinePreviewBootstrap') ||
    transportPanelText.includes('useTimelinePreviewMonitorContext') ||
    transportPanelText.includes('previewMonitorContext.monitorScopes') ||
    transportPanelText.includes('previewBootstrap.collection') ||
    transportPanelText.includes('previewBootstrap.documentKey') ||
    transportPanelText.includes('previewBootstrap.exportPlan') ||
    transportPanelText.includes('buildVideoSequenceExportPlan') ||
    transportPanelText.includes('resolveVisibleVideoSequenceTimelineLaneCount') ||
    transportPanelText.includes('readVideoSequenceTimelineModelFromMarkdown') ||
    transportPanelText.includes('buildVideoSequenceTimelineToolStatus') ||
    transportPanelText.includes('useGanttTimelineDisplayModel') ||
    transportPanelText.includes('useGanttTimelineMediaDuration') ||
    transportPanelText.includes('cleanTimelinePreviewDocumentKey') ||
    transportPanelText.includes('data-kg-video-sequence-export="video"') ||
    transportPanelText.includes('data-kg-video-sequence-export="audio"') ||
    transportPanelText.includes('data-kg-video-sequence-export="retry"') ||
    transportPanelText.includes('timeline-transport-export-session') ||
    transportPanelText.includes("'--kg-video-sequence-lane-count': visibleLaneCount") ||
    transportPanelText.includes('subtitleLabel={`${timelineModel.taskSpans.length} timeline rows`}') ||
    transportPanelText.includes('titleLabel="Gantt-Timeline"') ||
    transportPanelText.includes('value={clampTimelineTransportValue(positionMinutes, 0, Math.max(1, maxMinutes))}') ||
    !mediaCanvasText.includes('useTimelinePreviewMediaCanvasBinding') ||
    !mediaCanvasText.includes('mediaCanvasBinding.frameModel') ||
    !mediaCanvasText.includes('TimelinePreviewMediaCanvasFrame') ||
    !previewMediaCanvasBindingText.includes('useCommandMenuRichMediaInventory') ||
    !previewMediaCanvasBindingText.includes('useTimelineDocumentStoreBinding') ||
    !previewMediaCanvasBindingText.includes('useTimelineGanttSelectionStoreBinding') ||
    !previewMediaCanvasBindingText.includes('useTimelinePreviewRouteEntry') ||
    !previewMediaCanvasBindingText.includes('useTimelinePreviewMediaContext') ||
    previewMediaCanvasBindingText.includes('useTimelinePreviewBootstrap') ||
    !previewMediaCanvasBindingText.includes('collection: previewRouteEntry.bootstrap.collection') ||
    !previewMediaCanvasBindingText.includes('documentKey: previewRouteEntry.bootstrap.documentKey') ||
    !previewMediaCanvasBindingText.includes('exportPlan: previewRouteEntry.bootstrap.exportPlan') ||
    !previewMediaCanvasBindingText.includes('intent: previewRouteEntry.intent') ||
    !previewMediaCanvasBindingText.includes('frameModel: previewMediaContext.mediaCanvasFrame') ||
    !previewBootstrapText.includes('useTimelinePreviewBootstrap') ||
    !previewBootstrapText.includes('useTimelinePreviewCollection') ||
    !previewBootstrapText.includes('cleanTimelinePreviewDocumentKey') ||
    !previewBootstrapText.includes('const documentKey = cleanTimelinePreviewDocumentKey(args.markdownDocumentName)') ||
    !previewBootstrapText.includes('() => collection.previewPlan || collection.exportPlan') ||
    !previewCollectionText.includes('useTimelinePreviewCollection') ||
    !previewCollectionText.includes('useTimelinePreviewMediaSession') ||
    !previewCollectionText.includes('shouldIncludeTimelinePreviewCollectionItem') ||
    !previewMediaContextText.includes('useTimelinePreviewMediaContext') ||
    !previewMediaContextText.includes('useTimelinePreviewSurfaceModel') ||
    !previewMediaContextText.includes('useTimelinePreviewActivitySurfaceModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilyCompactionModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilyDisclosureController') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilyDisclosureModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilyDisclosureSurfaceModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilySectionLayoutModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilySectionChromeModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilySectionBodyModel') ||
    !previewMediaContextText.includes('useTimelinePreviewFamilySectionsModel') ||
    !previewMediaContextText.includes('useTimelinePreviewMediaCanvasRenderModel') ||
    !previewMediaContextText.includes('useTimelinePreviewMediaCanvasFrameModel') ||
    !previewMediaContextText.includes('useTimelinePreviewSurfaceShellModel') ||
    !previewScopeProjectionText.includes('useTimelinePreviewScopeProjection') ||
    !previewScopeProjectionText.includes('buildVideoSequenceTimelineScopes') ||
    !previewScopeProjectionText.includes('sourceCount') ||
    !previewScopeProjectionText.includes('spanCount') ||
    !previewMonitorContextText.includes('useTimelinePreviewMonitorContext') ||
    !previewMonitorContextText.includes('useTimelinePreviewMediaContext') ||
    !previewMonitorContextText.includes('useTimelinePreviewScopeProjection') ||
    !previewMonitorContextText.includes('monitorScopes: scopeProjection.monitorScopes') ||
    !previewMonitorBindingText.includes('useTimelinePreviewMonitorBinding') ||
    !previewMonitorBindingText.includes('useTimelinePreviewRouteEntry') ||
    !previewMonitorBindingText.includes('useTimelinePreviewMonitorContext') ||
    previewMonitorBindingText.includes('useTimelinePreviewBootstrap') ||
    !previewMonitorBindingText.includes('collection: previewRouteEntry.bootstrap.collection') ||
    !previewMonitorBindingText.includes('documentKey: previewRouteEntry.bootstrap.documentKey') ||
    !previewMonitorBindingText.includes('exportPlan: previewRouteEntry.bootstrap.exportPlan') ||
    !previewMonitorBindingText.includes('intent: previewRouteEntry.intent') ||
    !previewMonitorBindingText.includes('monitorScopes: previewMonitorContext.monitorScopes') ||
    !previewRouteEntryText.includes('useTimelinePreviewRouteEntry') ||
    !previewRouteEntryText.includes('useTimelinePreviewBootstrap') ||
    !previewRouteEntryText.includes("intent: 'media'") ||
    !previewRouteEntryText.includes("intent: 'monitor'") ||
    !previewRouteEntryText.includes("args.intent === 'media' ? previewBootstrap.collection.sequenceMaxMinutes : args.maxMinutes") ||
    !previewRouteEntryText.includes("args.intent === 'media' ? 0 : args.positionMinutes") ||
    !previewRouteEntryText.includes('bootstrap: previewBootstrap') ||
    !transportChromeModelText.includes('useGanttTimelineTransportChromeModel') ||
    !transportChromeModelText.includes('VIDEO_SEQUENCE_TIMELINE_TOOLS.map') ||
    !transportChromeModelText.includes('exportSessionCollection.surface.items.map') ||
    !transportChromeModelText.includes('exportSessionCollection.retryControl') ||
    !transportChromeModelText.includes('handleRetryEditedMediaExportRunId') ||
    !transportChromeModelText.includes('handleRetryEditedMediaExport(args.latestRetryableExportSession)') ||
    !transportChromeModelText.includes('Cancel edited video export') ||
    !transportChromeModelText.includes('Download edited video') ||
    !transportChromeModelText.includes('Cancel edited audio export') ||
    !transportChromeModelText.includes('Download edited audio') ||
    !transportContextControlsText.includes('GanttTimelineTransportContextControls') ||
    !transportContextControlsText.includes('VideoSequenceClipEditPanel') ||
    !transportContextControlsText.includes('timeline-transport-export-session') ||
    !transportContextControlsText.includes('data-kg-video-sequence-export-session-retry') ||
    !transportHeaderToolsText.includes('GanttTimelineTransportHeaderTools') ||
    !transportHeaderToolsText.includes('TimelineVideoSequenceToolButton') ||
    !transportHeaderToolsText.includes('timeline-video-sequence-tool-strip') ||
    !transportHeaderToolsText.includes('timeline-transport-chrome-actions') ||
    !transportHeaderToolsText.includes('data-kg-video-sequence-export={button.dataValue}') ||
    !transportRouteModelText.includes('useGanttTimelineTransportRouteModel') ||
    !transportRouteModelText.includes('useGanttTimelineTransportSurfaceModel') ||
    !transportRouteModelText.includes('surfaceModel: transportSurfaceModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportSurfaceModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportSession') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportCommandModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportInteractionModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportChromeModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportRulerModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportPlaybackModel') ||
    !transportSurfaceModelText.includes('useGanttTimelineTransportShellModel') ||
    !transportSurfaceModelText.includes('const rulerContentRef = React.useRef<HTMLElement | null>(null)') ||
    !transportSurfaceText.includes('GanttTimelineTransportSurface') ||
    !transportSurfaceText.includes('GanttTimelineTransportShell') ||
    !transportSurfaceText.includes('model: GanttTimelineTransportSurfaceModel') ||
    !transportSurfaceText.includes('chromeModel={args.model.chromeModel}') ||
    !transportSurfaceText.includes('rulerModel={args.model.rulerModel}') ||
    !transportSurfaceText.includes('shellModel={args.model.shellModel}') ||
    !transportCommandModelText.includes('useGanttTimelineTransportCommandModel') ||
    !transportCommandModelText.includes('useGanttTimelineDocumentActions') ||
    !transportCommandModelText.includes('chromeModelCommands') ||
    !transportCommandModelText.includes('handleCommittedDragUpdate: documentActions.handleCommittedDragUpdate') ||
    !transportCommandModelText.includes('handleVideoSequenceClipEdit: documentActions.handleVideoSequenceClipEdit') ||
    !transportRulerModelText.includes('useGanttTimelineTransportRulerModel') ||
    !transportRulerModelText.includes('clampTimelineTransportValue') ||
    !transportRulerModelText.includes("'--kg-video-sequence-lane-count': args.visibleLaneCount") ||
    !transportRulerModelText.includes("subtitleLabel: `${args.taskSpans.length} timeline rows`") ||
    !transportRulerModelText.includes("titleLabel: 'Gantt-Timeline'") ||
    !transportRulerModelText.includes('value: clampTimelineTransportValue(args.positionMinutes, 0, Math.max(1, args.maxMinutes))') ||
    !transportRulerModelText.includes('scopes: args.scopes') ||
    !transportRulerText.includes('GanttTimelineTransportRuler') ||
    !transportRulerText.includes('VideoSequenceTimelineRuler') ||
    !transportRulerText.includes('scopes={args.model.scopes}') ||
    !transportInteractionModelText.includes('useGanttTimelineTransportInteractionModel') ||
    !transportInteractionModelText.includes('useGanttTimelineInteractions') ||
    !transportInteractionModelText.includes('useGanttTimelineTransportView') ||
    !transportInteractionModelText.includes('useGanttTimelineSelectionSync') ||
    !transportInteractionModelText.includes('resolveMermaidGanttTimelineRowKeyAtPosition(args.timelineModel, position)') ||
    !transportInteractionModelText.includes('taskSpans: args.timelineModel.taskSpans') ||
    !transportShellModelText.includes('useGanttTimelineTransportShellModel') ||
    !transportShellModelText.includes("ariaLabel: 'Scrub Gantt-timeline position'") ||
    !transportShellModelText.includes("chromeClassName: 'timeline-transport-chrome--mermaid-gantt p-2'") ||
    !transportShellModelText.includes("shellClassName: 'timeline-transport-shell--video-sequence'") ||
    !transportShellModelText.includes("'data-kg-gantt-timeline-transport': 'bottomPanel'") ||
    !transportShellModelText.includes("'data-kg-video-sequence-timeline': 'source-backed'") ||
    !transportShellModelText.includes('showInlineProgress: false') ||
    !transportShellModelText.includes('showRange: false') ||
    !transportShellModelText.includes('step: 1') ||
    !transportShellText.includes('GanttTimelineTransportShell') ||
    !transportShellText.includes('TimelineTransportChrome') ||
    !transportShellText.includes('GanttTimelineTransportContextControls') ||
    !transportShellText.includes('GanttTimelineTransportHeaderTools') ||
    !transportShellText.includes('GanttTimelineTransportRuler') ||
    !transportShellText.includes('showInlineProgress={args.shellModel.showInlineProgress}') ||
    !transportShellText.includes('showRange={args.shellModel.showRange}') ||
    !transportPlaybackModelText.includes('useGanttTimelineTransportPlaybackModel') ||
    !transportPlaybackModelText.includes('useGanttTimelinePlaybackControls') ||
    !transportPlaybackModelText.includes('useTimelineTransportPlayback') ||
    !transportPlaybackModelText.includes('onPlaybackEnd: playbackControls.handlePlaybackEnd') ||
    !transportPlaybackModelText.includes('handlePlaybackPointerDown: playbackControls.handlePlaybackPointerDown') ||
    !transportPlaybackModelText.includes('handleTogglePlayback: playbackControls.handleTogglePlayback') ||
    !transportPlaybackModelText.includes('active: !args.disabled') ||
    !transportPlaybackModelText.includes('unitsPerMs: args.playbackUnitsPerMs') ||
    !transportPreviewSessionText.includes('useGanttTimelineTransportPreviewSession') ||
    !transportPreviewSessionText.includes('readVideoSequenceTimelineModelFromMarkdown') ||
    !transportPreviewSessionText.includes('useTimelinePreviewMonitorBinding') ||
    !transportPreviewSessionText.includes('sourceCount: videoSequenceModel?.sources.length || 0') ||
    !transportPreviewSessionText.includes('spanCount: args.taskSpans.length') ||
    !transportPreviewSessionText.includes('buildVideoSequenceExportPlan') ||
    !transportPreviewSessionText.includes('resolveVideoSequenceExportPlanError') ||
    !transportSessionText.includes('useGanttTimelineTransportSession') ||
    !transportSessionText.includes('useTimelineDocumentStoreBinding') ||
    !transportSessionText.includes('useTimelineGanttSelectionStoreBinding') ||
    !transportSessionText.includes('useTimelineTransportStoreBinding') ||
    !transportSessionText.includes('useTimelineDocumentTransportController') ||
    !transportSessionText.includes('cleanTimelinePreviewDocumentKey') ||
    !transportSessionText.includes('useGanttTimelineMediaDuration') ||
    !transportSessionText.includes('useGanttTimelineDisplayModel') ||
    !transportSessionText.includes('useGanttTimelineTransportPreviewSession') ||
    !transportSessionText.includes('buildVideoSequenceTimelineToolStatus') ||
    transportSessionText.includes('buildVideoSequenceExportPlan') ||
    transportSessionText.includes('resolveVideoSequenceExportPlanError') ||
    transportSessionText.includes('useTimelinePreviewMonitorBinding') ||
    transportSessionText.includes('readVideoSequenceTimelineModelFromMarkdown') ||
    !transportSessionText.includes('resolveVisibleVideoSequenceTimelineLaneCount') ||
    !previewActivitySurfaceModelText.includes('useTimelinePreviewActivitySurfaceModel') ||
    !previewActivitySurfaceModelText.includes("args.activityMode === 'selection' || args.activityMode === 'playhead'") ||
    !previewActivitySurfaceModelText.includes("return 'active'") ||
    !previewFamilyCompactionModelText.includes('useTimelinePreviewFamilyCompactionModel') ||
    !previewFamilyCompactionModelText.includes("if (args.intent !== 'media') return false") ||
    !previewFamilyCompactionModelText.includes('collapsedFamilyCount') ||
    !previewFamilyDisclosureControllerText.includes('useTimelinePreviewFamilyDisclosureController') ||
    !previewFamilyDisclosureControllerText.includes('React.useSyncExternalStore') ||
    !previewFamilyDisclosureControllerText.includes('React.useEffect') ||
    !previewFamilyDisclosureControllerText.includes('EMPTY_TIMELINE_PREVIEW_FAMILY_DISCLOSURE_SET') ||
    !previewFamilyDisclosureControllerText.includes('areTimelinePreviewFamilyDisclosureSetsEqual') ||
    !previewFamilyDisclosureControllerText.includes('autoExpandFamilyId?: string | null') ||
    !previewFamilyDisclosureControllerText.includes('familyIds: readonly string[]') ||
    !previewFamilyDisclosureControllerText.includes('if (autoExpandFamilyId && familyIdSet.has(autoExpandFamilyId))') ||
    !previewFamilyDisclosureModelText.includes('useTimelinePreviewFamilyDisclosureModel') ||
    !previewFamilyDisclosureModelText.includes('controller: TimelinePreviewFamilyDisclosureController') ||
    !previewFamilyDisclosureModelText.includes('toggleFamily') ||
    !previewFamilyDisclosureModelText.includes("return args.expanded ? 'expanded' : 'collapsed'") ||
    previewFamilyDisclosureModelText.includes('React.useState') ||
    !previewFamilyDisclosureSurfaceModelText.includes('useTimelinePreviewFamilyDisclosureSurfaceModel') ||
    !previewFamilyDisclosureSurfaceModelText.includes('headerVisible: toggleVisible') ||
    !previewFamilyDisclosureSurfaceModelText.includes('Hide variants') ||
    !previewFamilyDisclosureSurfaceModelText.includes('hidden variant') ||
    !previewFamilySectionLayoutModelText.includes('useTimelinePreviewFamilySectionLayoutModel') ||
    !previewFamilySectionLayoutModelText.includes('Rich media canvas sources') ||
    !previewFamilySectionLayoutModelText.includes('No rich media sources found in the active document.') ||
    !previewFamilySectionLayoutModelText.includes('sectionAttributes') ||
    !previewFamilySectionChromeModelText.includes('useTimelinePreviewFamilySectionChromeModel') ||
    !previewFamilySectionChromeModelText.includes('handleToggle: () => args.familyDisclosure.toggleFamily') ||
    !previewFamilySectionChromeModelText.includes("icon: sectionLayout.familySurface.toggleMode === 'collapse' ? 'collapse' : 'expand'") ||
    !previewFamilySectionChromeModelText.includes('dataValue: sectionLayout.familySummaryVisible ? sectionLayout.familySummaryLabel : undefined') ||
    !previewFamilySectionBodyModelText.includes('useTimelinePreviewFamilySectionBodyModel') ||
    !previewFamilySectionBodyModelText.includes('cardsLabel: sectionLayout.cardsLabel') ||
    !previewFamilySectionBodyModelText.includes('props: {') ||
    !previewFamilySectionBodyModelText.includes('documentKey: args.documentKey') ||
    !previewFamilySectionBodyModelText.includes('exportPlan: args.exportPlan') ||
    !previewFamilySectionBodyModelText.includes('sequenceMaxMinutes: args.sequenceMaxMinutes') ||
    !previewFamilySectionsModelText.includes('useTimelinePreviewFamilySectionsModel') ||
    !previewFamilySectionsModelText.includes('const bodySectionByFamilyId = new Map(') ||
    !previewFamilySectionsModelText.includes('const sectionBody = bodySectionByFamilyId.get(sectionChrome.familyId)') ||
    !previewFamilySectionsModelText.includes('cardsLabel: sectionBody.cardsLabel') ||
    !previewFamilySectionsModelText.includes('surfaces: sectionBody.surfaces') ||
    !previewMediaCanvasRenderModelText.includes('useTimelinePreviewMediaCanvasRenderModel') ||
    !previewMediaCanvasRenderModelText.includes("contentMode: args.surfaceShell.hasItems ? 'sections' : 'empty'") ||
    !previewMediaCanvasRenderModelText.includes('hostAttributes: {') ||
    !previewMediaCanvasRenderModelText.includes('listLabel: args.familySections.listLabel') ||
    !previewMediaCanvasRenderModelText.includes('shellLabel: args.surfaceShell.shellLabel') ||
    !previewMediaCanvasFrameModelText.includes('useTimelinePreviewMediaCanvasFrameModel') ||
    !previewMediaCanvasFrameModelText.includes('hostAttributes: args.renderModel.hostAttributes') ||
    !previewMediaCanvasFrameModelText.includes('renderModel: args.renderModel') ||
    !previewMediaCanvasFrameText.includes('TimelinePreviewMediaCanvasFrame') ||
    !previewMediaCanvasFrameText.includes('data-kg-media-canvas-group-count') ||
    !previewMediaCanvasFrameText.includes('<TimelinePreviewMediaCanvasRender model={args.model.renderModel} />') ||
    !previewSurfaceShellModelText.includes('useTimelinePreviewSurfaceShellModel') ||
    !previewSurfaceShellModelText.includes("shellLabel: 'Media canvas'") ||
    !previewSurfaceShellModelText.includes("titleLabel: 'Media'") ||
    !previewSurfaceShellModelText.includes('collapsedFamilyCount') ||
    !previewSurfaceShellModelText.includes('groupCount: args.familySectionLayout.sections.length') ||
    !previewMediaContextText.includes("autoExpandFamilyId: sourceActivity.activityMode === 'fallback'") ||
    !previewMediaContextText.includes('familyIds: familyCompaction.families.map(family => family.familyId)') ||
    !previewMediaContextText.includes('useTimelineSourceActivityModel') ||
    !timelineSourceActivityModelText.includes('useTimelineSourceActivityModel') ||
    !timelineSourceActivityModelText.includes('resolveTimelinePlanSegmentAtPosition') ||
    !timelineSourceActivityModelText.includes('areVideoSequenceExportSourcesEqual') ||
    !previewSurfaceModelText.includes('useTimelinePreviewSurfaceModel') ||
    !previewSurfaceModelText.includes('resolveTimelinePreviewFamilyId') ||
    !previewSurfaceModelText.includes('isTimelinePreviewItemVisibleForSurfaceIntent') ||
    !mediaCanvasText.includes('<TimelinePreviewMediaCanvasFrame') ||
    !mediaCanvasText.includes('model={mediaCanvasBinding.frameModel}') ||
    !previewMediaCanvasRenderText.includes('TimelinePreviewMediaCanvasRender') ||
    !previewMediaCanvasRenderText.includes('TimelinePreviewSurface') ||
    !previewMediaCanvasRenderText.includes('aria-label={args.model.listLabel}') ||
    !previewMediaCanvasRenderText.includes('aria-label={args.model.emptyState.label}') ||
    !previewMediaCanvasRenderText.includes('{args.model.emptyState.message}') ||
    !previewMediaCanvasRenderText.includes('data-kg-media-canvas-family-toggle="1"') ||
    !previewMediaCanvasRenderText.includes('data-kg-media-canvas-family-surface-tone') ||
    !previewMediaCanvasRenderText.includes('data-kg-media-canvas-family-toggle-mode') ||
    !previewMediaCanvasRenderText.includes('data-kg-media-canvas-family-summary=') ||
    !previewMediaCanvasRenderText.includes('data-kg-media-canvas-family-active-id') ||
    !previewMediaCanvasRenderText.includes('title={section.toggle.title}') ||
    !previewMediaCanvasRenderText.includes('onClick={section.toggle.handleToggle}') ||
    !previewMediaCanvasRenderText.includes("section.toggle.icon === 'collapse'") ||
    !previewMediaCanvasRenderText.includes('key={surface.renderKey}') ||
    !previewMediaCanvasRenderText.includes('{...surface.props}') ||
    mediaCanvasText.includes('useTimelinePreviewVideoBinding') ||
    mediaCanvasText.includes('useTimelineVideoPreviewSyncController') ||
    mediaCanvasText.includes('useTimelineDocumentTransportController') ||
    mediaCanvasText.includes('useTimelineTransportSnapshotReader') ||
    mediaCanvasText.includes('useTimelineTransportStoreBinding') ||
    mediaCanvasText.includes('TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT') ||
    mediaCanvasText.includes('useGraphStore.getState()') ||
    mediaCanvasText.includes('markdownDocumentName: s.markdownDocumentName') ||
    mediaCanvasText.includes('markdownText: s.markdownDocumentText') ||
    mediaCanvasText.includes('selectedGanttRowKey: s.mermaidDiagramSelectedRowKeyByKind.gantt') ||
    mediaCanvasText.includes('timelineTransportDocumentKey') ||
    mediaCanvasText.includes('timelineTransportPosition') ||
    mediaCanvasText.includes('timelineTransportPlaying') ||
    mediaCanvasText.includes('timelineTransportPlaybackRate') ||
    mediaCanvasText.includes('resolveTargetSeconds') ||
    !previewSurfaceText.includes('TimelinePreviewSurface') ||
    !previewSurfaceText.includes('buildStaticRichMediaPanelOverlayState') ||
    !previewSurfaceText.includes('useTimelinePreviewVideoBinding') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-active') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-dimmed') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-family-collapsed') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-family-disclosure-state') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-family-expanded') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-family-hidden-count') ||
    !previewSurfaceText.includes('data-kg-media-canvas-item-style-mode') ||
    !previewSurfaceText.includes('data-kg-video-sequence-media-sync') ||
    !previewSurfaceText.includes('videoControls={syncEnabled ? false : undefined}') ||
    !previewSurfaceText.includes('onVideoElement={args.item.kind ===') ||
    !previewVideoBindingText.includes('useTimelinePreviewVideoBinding') ||
    !previewVideoBindingText.includes('useTimelineDocumentTransportController') ||
    !previewVideoBindingText.includes('useTimelineTransportSnapshotReader') ||
    !previewVideoBindingText.includes('useTimelineTransportStoreBinding') ||
    !previewVideoBindingText.includes('useTimelineVideoPreviewSyncController') ||
    !previewVideoBindingText.includes('handleVideoElement') ||
    !previewVideoBindingText.includes('readVideo: () => videoElementRef.current') ||
    !playbackControlsText.includes('dispatchTimelineTransportPlaybackRequest') ||
    !playbackControlsText.includes('handlePlaybackPointerDown') ||
    !playbackControlsText.includes('handleTogglePlayback') ||
    !playbackControlsText.includes('handlePlaybackEnd') ||
    !selectionSyncText.includes('previousSelectedRowKeyRef') ||
    !selectionSyncText.includes('if (previousSelectedRowKey === args.selectedRowKey) return') ||
    !selectionSyncText.includes('args.taskSpans.find(span => span.rowKey === args.selectedRowKey)') ||
    !displayModelText.includes('formatVideoSequenceTimelineSecondsOffset') ||
    !displayModelText.includes('resolveVideoSequenceTimelineMediaSeconds') ||
    !displayModelText.includes('resolveVideoSequenceTimelineUnitsPerMs') ||
    !mediaDurationText.includes('resolveTimelinePlanDurationSeconds') ||
    !previewSyncText.includes('TIMELINE_TRANSPORT_PLAYBACK_REQUEST_EVENT') ||
    !previewSyncText.includes('resolveTimelineVideoPreviewTargetSeconds') ||
    !previewSyncText.includes('resolveTimelineVideoPreviewPositionMinutes') ||
    !previewSyncText.includes('TimelineTransportSnapshotReader') ||
    !previewSyncText.includes('if (video.paused || video.ended) writeTransportPosition()') ||
    !previewSyncText.includes('data-kg-video-sequence-playback-fallback') ||
    mediaCanvasText.includes('transportDocumentKey === documentKey && transportPlaying')
  ) {
    throw new Error('expected video sequence surfaces to expose embedded ruler scopes, clip cues, audio waveform/mix, header tools, and direct playback sync through shared owners')
  }
  if (
    formatVideoSequenceTimelineSecondsOffset(15.09) !== '0:15' ||
    resolveVideoSequenceTimelineMediaSeconds({ durationSeconds: 15, maxMinutes: 1, positionMinutes: 0.5 }) !== 7.5 ||
    resolveVideoSequenceTimelinePositionMinutes({ currentTimeSeconds: 7.5, durationSeconds: 15, maxMinutes: 1 }) !== 0.5 ||
    resolveVideoSequenceTimelineUnitsPerMs({ durationSeconds: 15, maxMinutes: 1, fallbackUnitsPerMs: 1 / 1000 }) !== 1 / 15000
  ) {
    throw new Error('expected video sequence timeline units to map Gantt geometry to playable media seconds')
  }
  const scopes = buildVideoSequenceTimelineScopes({
    activeFamilyId: 'video-sequence:opening',
    activityMode: 'selection',
    maxMinutes: 6,
    positionMinutes: 3,
    selectionActive: true,
    sourceCount: 1,
    spanCount: 8,
  })
  if (
    scopes.length !== 6 ||
    scopes.some(scope => scope.samples.length !== 12 || scope.value < 0 || scope.value > 100) ||
    !scopes.some(scope => scope.id === 'luma-waveform') ||
    !scopes.some(scope => scope.id === 'chroma-vectorscope') ||
    !scopes.some(scope => scope.id === 'audio-waveform') ||
    scopes[0]?.active !== true ||
    scopes[0]?.activeFamilyId !== 'video-sequence:opening' ||
    scopes[0]?.activityMode !== 'selection' ||
    scopes[0]?.selectionActive !== true
  ) {
    throw new Error(`expected bounded luma/chroma/audio scope samples, got ${JSON.stringify(scopes)}`)
  }
  const waveformSamples = buildVideoSequenceTimelineWaveformSamples({ sampleCount: 16, seedText: 'narration 港岛仿生局.mp4 audio' })
  const frameSamples = buildVideoSequenceTimelineFrameSamples({ sampleCount: 10, seedText: '港岛仿生局.mp4 video' })
  const cueSamples = buildVideoSequenceTimelineCueSamples({ sampleCount: 12, seedText: '港岛仿生局.mp4 video' })
  if (
    waveformSamples.length !== 16 ||
    waveformSamples.some(sample => sample < 0 || sample > 100) ||
    waveformSamples.join(',') !== buildVideoSequenceTimelineWaveformSamples({ sampleCount: 16, seedText: 'narration 港岛仿生局.mp4 audio' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded audio waveform samples for timeline ruler, got ${JSON.stringify(waveformSamples)}`)
  }
  if (
    frameSamples.length !== 10 ||
    frameSamples.some(sample => sample < 0 || sample > 100) ||
    frameSamples.join(',') !== buildVideoSequenceTimelineFrameSamples({ sampleCount: 10, seedText: '港岛仿生局.mp4 video' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded media frame samples for timeline ruler, got ${JSON.stringify(frameSamples)}`)
  }
  if (
    cueSamples.length !== 12 ||
    cueSamples.some(sample => sample < 0 || sample > 100) ||
    cueSamples.join(',') !== buildVideoSequenceTimelineCueSamples({ sampleCount: 12, seedText: '港岛仿生局.mp4 video' }).join(',')
  ) {
    throw new Error(`expected deterministic bounded media cue samples for timeline ruler, got ${JSON.stringify(cueSamples)}`)
  }
  const code = [
    'gantt',
    '  title Sequence',
    '  section Video',
    '  Opening shot : clip_opening, 09:00, 6m',
  ].join('\n')
  const fullWidthSpan = {
    durationMinutes: 15,
    endMinutes: 15,
    label: '港岛仿生局.mp4',
    lineIndex: 5,
    raw: '港岛仿生局.mp4 : clip_hk, 09:00, 15m',
    rowKey: '5:task:港岛仿生局.mp4 : clip_hk, 09:00, 15m',
    startMinutes: 0,
  }
  const clampedMovePreview = resolveMermaidGanttTimelineDragPreviewSpan({
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  const expandableMovePreview = resolveMermaidGanttTimelineDragPreviewSpan({
    allowTimelineExpansion: true,
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  const expandableDelta = resolveMermaidGanttTimelineDragEffectiveDelta({
    allowTimelineExpansion: true,
    deltaMinutes: 3,
    maxMinutes: 15,
    mode: 'move',
    span: fullWidthSpan,
  })
  if (
    clampedMovePreview.startMinutes !== 0 ||
    expandableMovePreview.startMinutes !== 3 ||
    expandableDelta !== 3
  ) {
    throw new Error(`expected video sequence move edits to allow full-width clips to create leading gap, got ${JSON.stringify({ clampedMovePreview, expandableMovePreview, expandableDelta })}`)
  }
  const fullWidthSequenceCode = [
    'gantt',
    '  title Video Sequence',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Video',
    '  港岛仿生局.mp4 : clip_hk, 00:00, 15m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 15m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_hk_grade, 00:00, 15m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 15m',
  ].join('\n')
  const movedFullWidthSequenceCode = updateMermaidGanttCodeRowTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'move',
    deltaMinutes: 3,
  })
  const movedFullWidthSequenceModel = buildMermaidGanttTimelineModel(movedFullWidthSequenceCode || '')
  const movedFullWidthVideoSpan = movedFullWidthSequenceModel.taskSpans.find(span => span.label === '港岛仿生局.mp4')
  const visibleSequenceLanes = resolveVisibleVideoSequenceTimelineLanes(movedFullWidthSequenceModel.taskSpans)
  const preciseTrimmedSequenceCode = updateMermaidGanttCodeRowTiming({
    code: fullWidthSequenceCode,
    rowLineIndex: 5,
    mode: 'resize-start',
    deltaMinutes: 2,
  })
  const preciseExtendedSequenceCode = updateMermaidGanttCodeRowTiming({
    code: preciseTrimmedSequenceCode || '',
    rowLineIndex: 5,
    mode: 'resize-end',
    deltaMinutes: 1,
  })
  if (
    !movedFullWidthSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_0_15, 00:03, 15m') ||
    movedFullWidthSequenceModel.durationMinutes !== 18 ||
    movedFullWidthVideoSpan?.startMinutes !== 3 ||
    movedFullWidthVideoSpan?.endMinutes !== 18 ||
    resolveVisibleVideoSequenceTimelineLaneCount(movedFullWidthSequenceModel.taskSpans) !== 4 ||
    visibleSequenceLanes.map(lane => lane.id).join(',') !== 'video,mask,grade,audio'
  ) {
    throw new Error(`expected moved full-width video sequence clip to remain visibly editable in a compact active-lane stack, got ${JSON.stringify({ movedFullWidthSequenceCode, movedFullWidthSequenceModel, movedFullWidthVideoSpan, visibleSequenceLanes })}`)
  }
  if (
    !preciseTrimmedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_2_15, 00:02, 13m') ||
    !preciseTrimmedSequenceCode.includes('港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 15m') ||
    !preciseExtendedSequenceCode?.includes('港岛仿生局.mp4 : clip_hk, kgsrc_2_16, 00:02, 14m') ||
    !preciseExtendedSequenceCode.includes('港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 15m')
  ) {
    throw new Error(`expected precise BottomPanel clip trim controls to edit only the selected lane, got ${JSON.stringify({ preciseTrimmedSequenceCode, preciseExtendedSequenceCode })}`)
  }
  const splitSequenceCode = [
    'gantt',
    '  title Video Sequence',
    '  dateFormat HH:mm',
    '  axisFormat %H:%M',
    '  section Video',
    '  港岛仿生局.mp4 : clip_hk, 00:00, 1m',
    '  港岛仿生局.mp4 splice : clip_hk_splice, 00:01, 4m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_hk_mask, 00:00, 1m',
    '  港岛仿生局.mp4 mask splice : clip_hk_mask_splice, 00:01, 4m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_hk_grade, 00:00, 1m',
    '  港岛仿生局.mp4 grade splice : clip_hk_grade_splice, 00:01, 4m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_hk_audio, 00:00, 1m',
    '  港岛仿生局.mp4 audio splice : clip_hk_audio_splice, 00:01, 4m',
  ].join('\n')
  const splitSequenceModel = buildMermaidGanttTimelineModel(splitSequenceCode)
  const splitSpliceSpan = splitSequenceModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 splice')
  const movedSplitSequenceCode = splitSpliceSpan
    ? updateMermaidGanttCodeRowTiming({
        code: splitSequenceCode,
        rowLineIndex: splitSpliceSpan.lineIndex,
        mode: 'move',
        deltaMinutes: 1,
      })
    : null
  const trimmedSplitSequenceCode = splitSpliceSpan
    ? updateMermaidGanttCodeRowTiming({
        code: splitSequenceCode,
        rowLineIndex: splitSpliceSpan.lineIndex,
        mode: 'resize-start',
        deltaMinutes: 1,
      })
    : null
  if (
    !splitSpliceSpan ||
    !movedSplitSequenceCode?.includes('港岛仿生局.mp4 splice : clip_hk_splice, kgsrc_1_5, 00:02, 4m') ||
    !movedSplitSequenceCode.includes('港岛仿生局.mp4 audio splice : clip_hk_audio_splice, 00:01, 4m') ||
    !trimmedSplitSequenceCode?.includes('港岛仿生局.mp4 splice : clip_hk_splice, kgsrc_2_5, 00:02, 3m') ||
    !trimmedSplitSequenceCode.includes('港岛仿生局.mp4 mask splice : clip_hk_mask_splice, 00:01, 4m')
  ) {
    throw new Error(`expected split/splice timeline clips to remain draggable and resizable as independently editable bars, got ${JSON.stringify({ movedSplitSequenceCode, splitSpliceSpan, trimmedSplitSequenceCode })}`)
  }
  const transitionCode = insertMermaidGanttVideoSequenceOperationRow({ code, rowLineIndex: 3, operation: 'transition' })
  const filterCode = insertMermaidGanttVideoSequenceOperationRow({ code: transitionCode || code, rowLineIndex: 3, operation: 'filter' })
  if (
    !transitionCode?.includes('Opening shot transition : clip_opening_transition, kgsrc_0_6, 09:00, 6m') ||
    !filterCode?.includes('Opening shot filter : clip_opening_filter, kgsrc_0_6, 09:00, 6m')
  ) {
    throw new Error(`expected expanded operation rows for transition and filter, got ${JSON.stringify({ transitionCode, filterCode })}`)
  }
  const sequenceSource: VideoSequenceTimelineSource = {
    byteSize: 100,
    id: 'clip_opening',
    importMode: 'url',
    mimeHint: 'video/mp4',
    originalName: 'opening.mp4',
    relativePath: 'opening.mp4',
    sourceUrl: 'https://media.example.test/opening.mp4',
    workspacePath: '',
  }
  const exportPlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Sequence',
      '  section Video',
      '  Opening shot : clip_opening, 09:00, 2m',
      '  Opening shot splice : clip_opening_splice, 09:02, 4m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const sourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: exportPlan,
    positionMinutes: 3,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const sourcePosition = resolveTimelinePlanPositionFromSourceTime({
    currentTimeSeconds: 7.5,
    plan: exportPlan,
    preferredPositionMinutes: 3,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const playheadSegment = resolveTimelinePlanSegmentAtPosition({
    plan: exportPlan,
    positionMinutes: 3,
  })
  if (
    Math.abs((sourceTime?.sourceTimeSeconds || 0) - 7.5) > 0.0001 ||
    Math.abs((sourcePosition || 0) - 3) > 0.0001 ||
    playheadSegment?.segment.label !== 'Opening shot splice' ||
    playheadSegment.contains !== true
  ) {
    throw new Error(`expected edited video sequence preview sync to resolve through source ranges, got ${JSON.stringify({ playheadSegment, sourcePosition, sourceTime })}`)
  }
  const movedSpliceOrderPlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Video Sequence',
      '  section Video',
      '  港岛仿生局.mp4 : clip_opening, 00:03, 1m',
      '  港岛仿生局.mp4 splice : clip_opening_splice, 00:01, 1m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const movedBaseSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: movedSpliceOrderPlan,
    positionMinutes: 3.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const movedSpliceSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: movedSpliceOrderPlan,
    positionMinutes: 1.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const movedBasePosition = resolveTimelinePlanPositionFromSourceTime({
    currentTimeSeconds: 3.75,
    plan: movedSpliceOrderPlan,
    preferredPositionMinutes: 3.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    Math.abs((movedBaseSourceTime?.sourceTimeSeconds || 0) - 3.75) > 0.0001 ||
    Math.abs((movedSpliceSourceTime?.sourceTimeSeconds || 0) - 11.25) > 0.0001 ||
    Math.abs((movedBasePosition || 0) - 3.5) > 0.0001
  ) {
    throw new Error(`expected moved split clips to preserve source order instead of visible timeline order, got ${JSON.stringify({ movedBasePosition, movedBaseSourceTime, movedSpliceSourceTime })}`)
  }
  const decoupledAudioPreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:00, 5m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:00, 15m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:04, 1m',
  ].join('\n')
  const decoupledAudioModel = buildMermaidGanttTimelineModel(decoupledAudioPreviewCode)
  const decoupledAudioSpan = decoupledAudioModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 audio')
  const decoupledVideoExportPlan = buildVideoSequenceExportPlan({
    code: decoupledAudioPreviewCode,
    filenameHint: 'Sequence.md',
    sources: [sequenceSource],
  })
  const decoupledAudioPreviewPlan = buildTimelinePreviewSyncPlan({
    code: decoupledAudioPreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: decoupledAudioSpan?.rowKey,
    sources: [sequenceSource],
  })
  const decoupledVideoSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: decoupledVideoExportPlan,
    positionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const decoupledAudioSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: decoupledAudioPreviewPlan,
    positionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const decoupledAudioPosition = resolveTimelinePlanPositionFromSourceTime({
    currentTimeSeconds: 4.5,
    plan: decoupledAudioPreviewPlan,
    preferredPositionMinutes: 4.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !decoupledAudioSpan ||
    Math.abs((decoupledVideoSourceTime?.sourceTimeSeconds || 0) - 13.5) > 0.0001 ||
    Math.abs((decoupledAudioSourceTime?.sourceTimeSeconds || 0) - 4.5) > 0.0001 ||
    Math.abs((decoupledAudioPosition || 0) - 4.5) > 0.0001
  ) {
    throw new Error(`expected Media canvas preview sync to follow the selected decoupled audio strip instead of the video lane, got ${JSON.stringify({ decoupledAudioPosition, decoupledAudioSourceTime, decoupledAudioSpan, decoupledVideoSourceTime })}`)
  }
  const multiLanePreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:03, 1m',
    '  港岛仿生局.mp4 splice : clip_opening_splice, 00:01, 1m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_opening_mask, 00:00, 1m',
    '  港岛仿生局.mp4 mask splice : clip_opening_mask_splice, 00:01, 1m',
    '  港岛仿生局.mp4 mask splice splice : clip_opening_mask_splice_splice, 00:02, 3m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:00, 1m',
    '  港岛仿生局.mp4 grade splice : clip_opening_grade_splice, 00:01, 1m',
    '  港岛仿生局.mp4 grade splice splice : clip_opening_grade_splice_splice, 00:02, 3m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:00, 1m',
    '  港岛仿生局.mp4 audio splice : clip_opening_audio_splice, 00:06, 1m',
    '  港岛仿生局.mp4 audio splice splice : clip_opening_audio_splice_splice, 00:13, 2m',
  ].join('\n')
  const multiLaneModel = buildMermaidGanttTimelineModel(multiLanePreviewCode)
  const selectedMaskSpan = multiLaneModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 mask splice splice')
  const selectedMaskPreviewPlan = buildTimelinePreviewSyncPlan({
    code: multiLanePreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: selectedMaskSpan?.rowKey,
    sources: [sequenceSource],
  })
  const selectedMaskSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: selectedMaskPreviewPlan,
    positionMinutes: 2.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const selectedMaskPosition = resolveTimelinePlanPositionFromSourceTime({
    currentTimeSeconds: 2.5,
    plan: selectedMaskPreviewPlan,
    preferredPositionMinutes: 2.5,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !selectedMaskSpan ||
    Math.abs((selectedMaskSourceTime?.sourceTimeSeconds || 0) - 2.5) > 0.0001 ||
    Math.abs((selectedMaskPosition || 0) - 2.5) > 0.0001
  ) {
    throw new Error(`expected multi-lane BottomPanel preview sync to use absolute timeline timecodes across mask/grade/audio edits, got ${JSON.stringify({ selectedMaskPosition, selectedMaskSourceTime, selectedMaskSpan })}`)
  }
  const boundedAudioPreviewCode = [
    'gantt',
    '  title Video Sequence',
    '  section Video',
    '  港岛仿生局.mp4 : clip_opening, 00:01, 3m',
    '  section Mask',
    '  港岛仿生局.mp4 mask : clip_opening_mask, 00:03, 1m',
    '  section Grade',
    '  港岛仿生局.mp4 grade : clip_opening_grade, 00:03, 12m',
    '  section Audio',
    '  港岛仿生局.mp4 audio : clip_opening_audio, 00:02, 2m',
  ].join('\n')
  const boundedAudioModel = buildMermaidGanttTimelineModel(boundedAudioPreviewCode)
  const boundedAudioSpan = boundedAudioModel.taskSpans.find(span => span.label === '港岛仿生局.mp4 audio')
  const boundedAudioPreviewPlan = buildTimelinePreviewSyncPlan({
    code: boundedAudioPreviewCode,
    filenameHint: 'Sequence.md',
    selectedRowKey: boundedAudioSpan?.rowKey,
    sources: [sequenceSource],
  })
  const boundedAudioSourceTime = resolveTimelinePlanSourceTimeAtPosition({
    plan: boundedAudioPreviewPlan,
    positionMinutes: 15,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  const boundedAudioPosition = resolveTimelinePlanPositionFromSourceTime({
    currentTimeSeconds: 15,
    plan: boundedAudioPreviewPlan,
    preferredPositionMinutes: 15,
    source: sequenceSource,
    sourceDurationSeconds: 15,
  })
  if (
    !boundedAudioSpan ||
    Math.abs((boundedAudioSourceTime?.sourceTimeSeconds || 0) - 4) > 0.0001 ||
    Math.abs((boundedAudioPosition || 0) - 4) > 0.0001
  ) {
    throw new Error(`expected out-of-strip audio sync to clamp to the selected strip boundary instead of falling back to full media time, got ${JSON.stringify({ boundedAudioPosition, boundedAudioSourceTime, boundedAudioSpan })}`)
  }
  const sourceMirror: VideoSequenceTimelineSource = {
    ...sequenceSource,
    id: '',
    sourceUrl: '',
    workspacePath: 'workspace/opening.mp4',
  }
  const sourceSibling: VideoSequenceTimelineSource = {
    ...sequenceSource,
    id: 'closing',
    originalName: 'closing.mp4',
    relativePath: 'closing.mp4',
    sourceUrl: 'https://media.example.test/closing.mp4',
    workspacePath: '',
  }
  if (
    !areVideoSequenceExportSourcesEqual(sequenceSource, sourceMirror) ||
    areVideoSequenceExportSourcesEqual(sequenceSource, sourceSibling)
  ) {
    throw new Error('expected video sequence source identity matching to stay source-owned and avoid broad filename fallbacks')
  }
  const multiSourcePlan = buildVideoSequenceExportPlan({
    code: [
      'gantt',
      '  title Sequence',
      '  section Video',
      '  Opening shot : clip_opening, 09:00, 2m',
      '  Insert shot : closing, 09:04, 2m',
      '  Opening shot splice : clip_opening_splice, 09:08, 4m',
      '  Opening shot splice grade : clip_opening_grade_splice, 09:08, 4m',
      '  Opening shot splice transition : clip_opening_transition_splice, 09:08, 4m',
    ].join('\n'),
    filenameHint: 'Sequence.md',
    sources: [sequenceSource, sourceSibling],
  })
  const segments = multiSourcePlan?.segments || []
  const firstOpening = segments.find(segment => segment.label === 'Opening shot')
  const insertShot = segments.find(segment => segment.label === 'Insert shot')
  const openingSplice = segments.find(segment => segment.label === 'Opening shot splice')
  if (
    multiSourcePlan?.durationMinutes !== 12 ||
    segments.length !== 3 ||
    !firstOpening ||
    !insertShot ||
    !openingSplice ||
    firstOpening.sourceStartRatio !== 0 ||
    Math.abs(firstOpening.sourceEndRatio - (2 / 6)) > 0.0001 ||
    insertShot.source !== sourceSibling ||
    insertShot.timelineStartMinutes !== 4 ||
    insertShot.timelineEndMinutes !== 6 ||
    Math.abs(openingSplice.sourceStartRatio - (2 / 6)) > 0.0001 ||
    openingSplice.sourceEndRatio !== 1 ||
    !openingSplice.hasGrade ||
    openingSplice.hasMask ||
    resolveTimelinePlanSourceTimeAtPosition({
      plan: multiSourcePlan,
      positionMinutes: 8,
      source: sequenceSource,
      sourceDurationSeconds: 18,
    })?.sourceTimeSeconds !== 6
  ) {
    throw new Error(`expected gaps, multiple sources, splice ranges, and operation lanes to compile into a stable preview plan, got ${JSON.stringify(multiSourcePlan)}`)
  }
}
