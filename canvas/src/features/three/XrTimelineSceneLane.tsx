import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { GanttTimelineTransportPanel } from '@/features/gitgraph/GanttTimelineTransportPanel'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useTimelineTransportStoreBinding } from '@/components/timeline/timelineTransport'
import { cleanTimelinePreviewDocumentKey } from '@/components/timeline/useTimelinePreviewBootstrap'
import { readCameraFramingRuntime } from '@/features/strybldr/cameraFramingRuntime'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  buildXrMotionReferencePackage,
  sampleXrMotionReferenceMarks,
  serializeXrMotionReferencePlan,
  xrMotionReferencePackageBlob,
  xrMotionReferencePackageFilename,
  xrMotionReferenceSceneKey,
  type XrMotionReferenceStageId,
  type XrMotionReferenceTransition,
} from './xrMotionReferenceModel'
import {
  hydrateXrMotionReferenceRuntime,
  markXrMotionReferenceSaved,
  readXrMotionReferenceRuntime,
  selectXrMotionReferenceActor,
  setXrMotionReferenceCameraMark,
  setXrMotionReferenceCastMark,
  setXrMotionReferenceDuration,
  setXrMotionReferenceFps,
  setXrMotionReferencePlayhead,
  setXrMotionReferenceStage,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import { buildXrMotionReferenceTimelineCode } from './xrMotionReferenceTimeline'
import { resolveXrPanelSourceProfile } from './xrPanelModel'
import { downloadBlob } from '@/lib/graph/save'
import { PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

function finiteInput(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function XrTimelineSceneLane() {
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
  const [markX, setMarkX] = React.useState('0')
  const [markY, setMarkY] = React.useState('0')
  const [markZ, setMarkZ] = React.useState('0')
  const [markTransition, setMarkTransition] = React.useState<XrMotionReferenceTransition>('linear')

  const documentLoaded = Boolean(
    String(markdownDocumentName || '').trim()
    && String(markdownDocumentText || '').trim(),
  )
  const graphData = documentLoaded ? activeGraphData || rawGraphData : null
  const persistedValue = graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  const sceneKey = React.useMemo(
    () => xrMotionReferenceSceneKey(markdownDocumentName || 'Untitled', graphData),
    [graphData, markdownDocumentName],
  )
  const sourceProfile = React.useMemo(
    () => resolveXrPanelSourceProfile(markdownDocumentText || ''),
    [markdownDocumentText],
  )
  const documentKey = cleanTimelinePreviewDocumentKey(markdownDocumentName || '')
  const xrTransportDocumentKey = `${documentKey || 'Untitled'}#xr-motion`
  const selectedTrack = runtime.plan.cast.find(track => track.actorId === runtime.selectedActorId)
    || runtime.plan.cast[0]
    || null
  const timelineCode = React.useMemo(
    () => buildXrMotionReferenceTimelineCode(runtime.plan),
    [runtime.plan],
  )

  React.useEffect(() => {
    hydrateXrMotionReferenceRuntime({
      sceneKey,
      nodes: graphData?.nodes || [],
      persistedValue,
    })
  }, [graphData?.nodes, persistedValue, sceneKey])

  React.useEffect(() => {
    if (transportDocumentKey !== xrTransportDocumentKey) return
    setXrMotionReferencePlayhead(transportPosition * 60)
  }, [transportDocumentKey, transportPosition, xrTransportDocumentKey])

  React.useEffect(() => {
    if (!selectedTrack) return
    const position = sampleXrMotionReferenceMarks(selectedTrack.marks, runtime.playheadSeconds)
    setMarkX(String(position[0]))
    setMarkY(String(position[1]))
    setMarkZ(String(position[2]))
  }, [runtime.playheadSeconds, selectedTrack])

  const addCastMark = React.useCallback(() => {
    if (!selectedTrack) return
    setXrMotionReferenceCastMark({
      actorId: selectedTrack.actorId,
      timeSeconds: runtime.playheadSeconds,
      position: [
        finiteInput(markX, 0),
        finiteInput(markY, 0),
        finiteInput(markZ, 0),
      ],
      transition: markTransition,
    })
  }, [markTransition, markX, markY, markZ, runtime.playheadSeconds, selectedTrack])

  const captureCameraMark = React.useCallback(() => {
    const framing = readCameraFramingRuntime()
    setXrMotionReferenceCameraMark({
      timeSeconds: runtime.playheadSeconds,
      anchorId: framing.anchorId,
      settings: { ...framing.settings },
    })
  }, [runtime.playheadSeconds])

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

  const xrActive = canvasRenderMode === '3d' && canvas3dMode === 'xr'
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes.length : 0
  const edges = Array.isArray(graphData?.edges) ? graphData.edges.length : 0

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
      <header
        className={cn('flex flex-wrap items-end gap-1 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
        aria-label="XR Timeline player controls"
        data-kg-xr-timeline-player-controls="1"
      >
        <section className="mr-auto min-w-32 self-center">
          <h3 className="text-[11px] font-semibold uppercase">XR stage &amp; motion</h3>
          <p className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>
            {documentLoaded ? `${nodes} cast · ${edges} links` : 'World ready'} · {runtime.plan.camera.length} camera marks
          </p>
        </section>

        <label className="grid min-w-36 gap-0.5 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Stage</span>
          <PanelSelect
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

        <label className="grid min-w-28 gap-0.5 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Cast</span>
          <PanelSelect
            aria-label="XR cast member"
            value={selectedTrack?.actorId || ''}
            disabled={!selectedTrack}
            onChange={event => selectXrMotionReferenceActor(event.target.value)}
          >
            {runtime.plan.cast.length ? runtime.plan.cast.map(track => (
              <option key={track.actorId} value={track.actorId}>{track.label}</option>
            )) : <option value="">No cast</option>}
          </PanelSelect>
        </label>

        {([
          ['X', markX, setMarkX],
          ['Y', markY, setMarkY],
          ['Z', markZ, setMarkZ],
        ] as const).map(([label, value, setter]) => (
          <label key={label} className="grid w-14 gap-0.5 text-[10px]">
            <span className={UI_THEME_TOKENS.text.tertiary}>{label} m</span>
            <PanelTextInput aria-label={`XR cast ${label} coordinate`} type="number" step={0.1} value={value} onChange={event => setter(event.target.value)} />
          </label>
        ))}

        <label className="grid w-20 gap-0.5 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Motion</span>
          <PanelSelect value={markTransition} onChange={event => setMarkTransition(event.target.value as XrMotionReferenceTransition)}>
            <option value="linear">Travel</option>
            <option value="hold">Hold</option>
          </PanelSelect>
        </label>

        <label className="grid w-16 gap-0.5 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Seconds</span>
          <PanelTextInput type="number" min={1} max={30} step={0.5} value={runtime.plan.durationSeconds} onChange={event => setXrMotionReferenceDuration(Number(event.target.value))} />
        </label>
        <label className="grid w-14 gap-0.5 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>FPS</span>
          <PanelTextInput type="number" min={6} max={30} step={1} value={runtime.plan.fps} onChange={event => setXrMotionReferenceFps(Number(event.target.value))} />
        </label>

        <button type="button" className="App-toolbar__btn" disabled={!selectedTrack} onClick={addCastMark} data-kg-xr-motion-add-cast-mark="1">
          Mark cast @ {runtime.playheadSeconds.toFixed(2)}s
        </button>
        <button type="button" className="App-toolbar__btn" onClick={captureCameraMark} data-kg-xr-motion-add-camera-mark="1">
          Capture camera
        </button>
        <button type="button" className="App-toolbar__btn" disabled={!graphData || !runtime.dirty} onClick={savePlan} data-kg-xr-motion-save="1">
          Save
        </button>
        <button type="button" className="App-toolbar__btn" disabled={!graphData} onClick={exportPackage} data-kg-xr-motion-export="1">
          Export package
        </button>
      </header>

      <section aria-label="XR motion lanes" data-kg-xr-timeline-transport="reused-gantt-player">
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
        />
      </section>
    </section>
  )
}
