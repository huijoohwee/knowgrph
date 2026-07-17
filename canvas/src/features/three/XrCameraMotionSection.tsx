import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { TimelineTransportInlineClip } from '@/components/timeline/TimelineTransportControls'
import { GanttTimelineTransportPanel } from '@/features/gitgraph/GanttTimelineTransportPanel'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useTimelineTransportStoreBinding } from '@/components/timeline/timelineTransport'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  serializeXrMotionReferencePlan,
  type XrMotionReferenceStageId,
} from './xrMotionReferenceModel'
import { buildXrMotionReferencePackage, xrMotionReferencePackageBlob, xrMotionReferencePackageFilename } from './xrMotionReferencePackage'
import {
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  setXrMotionReferenceDuration,
  setXrMotionReferenceFps,
  setXrMotionReferencePlayhead,
  setXrMotionReferenceStage,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import { buildXrMotionReferenceTimelineCode, xrMotionReferenceTimelineDocumentKey } from './xrMotionReferenceTimeline'
import { CameraMotionMarkRetime } from './CameraMotionMarkRetime'
import { resolveXrPanelSourceProfile } from './xrPanelModel'
import { resolveXrChoreographySpeedWarnings } from './xrChoreographyDiagnostics'
import { downloadBlob } from '@/lib/graph/save'
import { PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export function XrCameraMotionSection() {
  const activeGraphData = useActiveGraphRenderData(true)
  const {
    canvas3dMode,
    canvasRenderMode,
    graphData: rawGraphData,
    markdownDocumentName,
    markdownDocumentText,
    pushUiToast,
    updateGraphMetadata,
  } = useGraphStore(
    useShallow(state => ({
      canvas3dMode: state.canvas3dMode,
      canvasRenderMode: state.canvasRenderMode,
      graphData: state.graphData,
      markdownDocumentName: state.markdownDocumentName,
      markdownDocumentText: state.markdownDocumentText,
      pushUiToast: state.pushUiToast,
      updateGraphMetadata: state.updateGraphMetadata,
    })),
  )
  const { transportDocumentKey, transportPosition } = useTimelineTransportStoreBinding()
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const xrActive = canvasRenderMode === '3d' && canvas3dMode === 'xr'

  const documentLoaded = Boolean(
    String(markdownDocumentName || '').trim()
    && String(markdownDocumentText || '').trim(),
  )
  const graphData = documentLoaded ? activeGraphData || rawGraphData : null
  const sourceProfile = React.useMemo(
    () => resolveXrPanelSourceProfile(markdownDocumentText || ''),
    [markdownDocumentText],
  )
  const xrTransportDocumentKey = xrMotionReferenceTimelineDocumentKey(markdownDocumentName)
  const timelineCode = React.useMemo(
    () => buildXrMotionReferenceTimelineCode(runtime.plan),
    [runtime.plan],
  )
  const speedWarnings = React.useMemo(() => resolveXrChoreographySpeedWarnings(runtime.plan), [runtime.plan])

  React.useEffect(() => {
    if (!xrActive) return
    if (transportDocumentKey !== xrTransportDocumentKey) return
    setXrMotionReferencePlayhead(transportPosition * 60)
  }, [transportDocumentKey, transportPosition, xrActive, xrTransportDocumentKey])

  const savePlan = React.useCallback(() => {
    if (!graphData) return
    const serialized = serializeXrMotionReferencePlan(readXrMotionReferenceRuntime().plan)
    updateGraphMetadata({ [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serialized })
    const savedValue = useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
    if (savedValue !== serialized) {
      pushUiToast({
        id: 'xr:motion-reference:save-error',
        kind: 'error',
        message: 'XR motion-reference plan could not be written to graph metadata.',
      })
      return
    }
    markXrMotionReferenceSaved(serialized)
    pushUiToast({
      id: 'xr:motion-reference:save',
      kind: 'success',
      message: 'XR motion-reference plan saved to graph metadata.',
    })
  }, [graphData, pushUiToast, updateGraphMetadata])

  const exportPackage = React.useCallback(() => {
    if (!graphData) return
    const bundle = buildXrMotionReferencePackage({
      plan: readXrMotionReferenceRuntime().plan,
      graphData,
      documentName: markdownDocumentName || 'Untitled',
    })
    downloadBlob(xrMotionReferencePackageBlob(bundle), xrMotionReferencePackageFilename(bundle))
    pushUiToast({
      id: 'xr:motion-reference:export',
      kind: 'success',
      message: `Exported ${bundle.timeline.frameCount} deterministic motion samples.`,
    })
  }, [graphData, markdownDocumentName, pushUiToast])

  const edges = Array.isArray(graphData?.edges) ? graphData.edges.length : 0
  if (!xrActive) return null

  return (
    <section
      className="min-w-0 space-y-2"
      aria-label="XR Timeline player"
      data-kg-xr-timeline-player="1"
      data-kg-xr-timeline-lane="scene"
      data-kg-xr-timeline-document-loaded={documentLoaded ? '1' : '0'}
      data-kg-xr-timeline-source-format={sourceProfile.format}
      data-kg-xr-timeline-scene="player"
      data-kg-xr-timeline-runtime={xrActive ? 'active' : 'available'}
    >
      <section aria-label="XR animation timeline" data-kg-xr-timeline-transport="reused-gantt-player">
        <GanttTimelineTransportPanel
          code={timelineCode}
          clockActive
          compact
          editable={false}
          mode="media"
          publishPlaybackRequest={false}
          runtimeDocumentKey={xrTransportDocumentKey}
          runtimeDurationSeconds={runtime.plan.durationSeconds}
          runtimeFrameRate={runtime.plan.fps}
          timeAxisControls={(
            <section className="flex min-w-0 items-center gap-2" aria-label="XR timeline scale controls" data-kg-timeline-axis-controls-layout="duration-fps">
              <label className="flex min-w-0 items-center gap-1 text-[9px]" data-kg-xr-timeline-seconds-control="time-axis">
                <span className={UI_THEME_TOKENS.text.tertiary}>Seconds</span>
                <PanelTextInput
                  aria-label="XR timeline seconds"
                  className="h-5 w-12 px-1 py-0 text-[10px]"
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={runtime.plan.durationSeconds}
                  onChange={event => setXrMotionReferenceDuration(Number(event.target.value))}
                />
              </label>
              <label className="flex min-w-0 items-center gap-1 text-[9px]" data-kg-xr-timeline-fps-control="time-axis">
                <span className={UI_THEME_TOKENS.text.tertiary}>FPS</span>
                <PanelTextInput
                  aria-label="XR timeline FPS"
                  className="h-5 w-12 px-1 py-0 text-[10px]"
                  type="number"
                  min={6}
                  max={30}
                  step={1}
                  value={runtime.plan.fps}
                  onChange={event => setXrMotionReferenceFps(Number(event.target.value))}
                />
              </label>
            </section>
          )}
          supplementalLanes={(<>
            <section
              className="timeline-transport-supplemental-lane"
              aria-label="XR Timeline player controls"
              data-kg-xr-timeline-consolidated-lane="stage-output-ruler"
              data-kg-xr-timeline-player-controls="1"
              data-kg-xr-timeline-cast-row-count={runtime.plan.cast.length}
            >
              <header className="timeline-transport-supplemental-lane-label">XR control</header>
              <section className="timeline-transport-supplemental-lane-content">
                <TimelineTransportInlineClip
                  laneStyle="video"
                  label="Stage & output"
                  aria-label="XR stage and output control bar"
                  data-kg-xr-timeline-control-bar="stage-output"
                >
                  <p className={cn('mr-2 whitespace-nowrap text-[9px]', UI_THEME_TOKENS.text.tertiary)}>
                    {documentLoaded ? `${runtime.plan.cast.length} cast · ${edges} links` : 'World ready'} · {runtime.plan.camera.length} camera marks · {speedWarnings.length ? `${speedWarnings.length} speed warnings` : 'speed sane'}
                  </p>

                  <CameraMotionMarkRetime layout="controls" />

                  <label className="flex shrink-0 items-center gap-1 text-[10px]">
                    <span className={UI_THEME_TOKENS.text.tertiary}>Stage</span>
                    <PanelSelect
                      className="w-36"
                      aria-label="XR grey-box stage"
                      value={runtime.plan.stageId}
                      onChange={event => setXrMotionReferenceStage(event.target.value as XrMotionReferenceStageId)}
                      data-kg-xr-motion-stage-select="1"
                    >
                      {XR_MOTION_REFERENCE_STAGE_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </PanelSelect>
                  </label>

                  <button type="button" className="App-toolbar__btn" disabled={!graphData || !runtime.dirty} onClick={savePlan} data-kg-xr-motion-save="1">
                    Save
                  </button>
                  <button type="button" className="App-toolbar__btn" disabled={!graphData} onClick={exportPackage} data-kg-xr-motion-export="1">
                    Export package
                  </button>
                </TimelineTransportInlineClip>
              </section>
            </section>
            <section
              className="timeline-transport-supplemental-lane xr-camera-motion-choreography-tracks"
              aria-label="Cast and camera choreography tracks"
              data-kg-xr-timeline-choreography-lanes="per-track"
              style={{ '--kg-xr-choreography-lane-count': runtime.plan.cast.length + 1 } as React.CSSProperties}
            >
              <header className="timeline-transport-supplemental-lane-label xr-camera-motion-retime-lane-labels">
                {runtime.plan.cast.map(track => (
                  <span key={track.actorId} data-kg-xr-choreography-cast-lane-label={track.actorId}>
                    <i aria-hidden style={{ backgroundColor: track.color }} />
                    <b title={track.label}>{track.label}</b>
                    <small>{track.marks.length}</small>
                  </span>
                ))}
                <span data-kg-xr-choreography-camera-lane-label="1">
                  <i aria-hidden className="xr-camera-motion-retime-camera-swatch" />
                  <b>Camera</b>
                  <small>{runtime.plan.camera.length}</small>
                </span>
              </header>
              <section className="timeline-transport-supplemental-lane-content timeline-transport-supplemental-lane-content--time-axis xr-camera-motion-retime-lane-content">
                <CameraMotionMarkRetime layout="lanes" />
              </section>
            </section>
          </>)}
        />
      </section>
    </section>
  )
}
