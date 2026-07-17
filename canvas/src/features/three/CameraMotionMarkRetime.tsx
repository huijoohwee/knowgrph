import React from 'react'
import { Trash2 } from 'lucide-react'
import { TimelineTransportTimeAxisMark } from '@/components/timeline/TimelineTransportControls'
import { resolveVideoSequenceRulerInsetLeft } from '@/components/timeline/videoSequenceTimelineRulerGeometry'
import { resolveVideoSequenceTimelineScaleDurationSeconds } from '@/components/timeline/videoSequenceTimelineZoom'
import { PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { XR_MOTION_REFERENCE_SELECTION_COLOR } from './xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  removeXrMotionReferenceCameraMark,
  removeXrMotionReferenceCastMark,
  retimeXrMotionReferenceCameraMark,
  retimeXrMotionReferenceCastMark,
  selectXrMotionReferenceCameraMark,
  selectXrMotionReferenceCastMark,
  setXrMotionReferenceCameraMarkEasing,
  setXrMotionReferenceCastMarkChoreography,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import { readBoundXrSelectedActorId, selectBoundXrActor } from './xrSelectedActorBinding'
import { resolveXrChoreographySpeedWarnings, type XrChoreographySpeedWarning } from './xrChoreographyDiagnostics'
import { XrChoreographyMarkControls } from './XrChoreographyMarkControls'
import './CameraMotionMarkRetime.css'

function TimeEditor({
  label,
  value,
  max,
  onChange,
  compact = false,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  compact?: boolean
}) {
  return (
    <PanelTextInput
      className={compact ? 'h-5 w-12 px-1 py-0 text-[9px]' : 'h-6 w-16 px-1 text-[10px]'}
      aria-label={label}
      type="number"
      min={0}
      max={max}
      step={0.05}
      value={value}
      onKeyDown={event => event.stopPropagation()}
      onChange={event => onChange(Number(event.target.value))}
    />
  )
}

function selectMarkOnKeyDown(event: React.KeyboardEvent<HTMLElement>, selectMark: () => void): void {
  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  selectMark()
}

function markAxisStyle(timeSeconds: number, scaleDurationSeconds: number): React.CSSProperties {
  const percent = scaleDurationSeconds > 0
    ? Math.min(100, Math.max(0, (timeSeconds / scaleDurationSeconds) * 100))
    : 0
  return { '--kg-xr-retime-mark-left': resolveVideoSequenceRulerInsetLeft(percent) } as React.CSSProperties
}

type XrCastTrack = ReturnType<typeof readXrMotionReferenceRuntime>['plan']['cast'][number]

function CastTrackTimeAxisRow({
  durationSeconds,
  runtime,
  scaleDurationSeconds,
  selectedActorId,
  warnings,
  track,
}: {
  durationSeconds: number
  runtime: ReturnType<typeof readXrMotionReferenceRuntime>
  scaleDurationSeconds: number
  selectedActorId: string
  warnings: readonly XrChoreographySpeedWarning[]
  track: XrCastTrack
}) {
  const actorSelected = selectedActorId === track.actorId
  const selectedMark = track.marks.find(mark => runtime.selectedMark?.kind === 'cast'
    && runtime.selectedMark.actorId === track.actorId
    && runtime.selectedMark.markId === mark.id) || track.marks[0]
  const selectedWarning = selectedMark ? warnings.find(warning => warning.targetKind === 'cast' && warning.fromMarkId === selectedMark.id) : undefined
  return (
    <section
      className="xr-camera-motion-retime-axis-row xr-camera-motion-retime-cast-row"
      aria-label={`${track.label} cast mark times`}
      data-kg-xr-retime-cast-track={track.actorId}
      data-kg-xr-retime-cast-track-selected={actorSelected ? '1' : '0'}
      data-kg-xr-retime-lane-ui="video"
      style={{ '--kg-xr-cast-track-color': track.color } as React.CSSProperties}
    >
      <button
        type="button"
        className="xr-camera-motion-retime-cast-bar"
        aria-label={`Select ${track.label} cast track`}
        aria-pressed={actorSelected}
        onClick={() => selectBoundXrActor(track.actorId)}
      >
        <span className="xr-camera-motion-retime-cast-swatch" aria-hidden />
        <span className="xr-camera-motion-retime-cast-label" title={track.label}>{track.label}</span>
        <span className="xr-camera-motion-retime-cast-count">{track.marks.length} mark{track.marks.length === 1 ? '' : 's'}</span>
      </button>
      {actorSelected && selectedMark ? (
        <section className="xr-camera-motion-retime-choreography" data-kg-xr-retime-cast-choreography={track.actorId}>
          <XrChoreographyMarkControls
            compact
            target={{ kind: 'cast', actorId: track.actorId, mark: selectedMark }}
            warning={selectedWarning}
            onChange={update => update.kind === 'cast' && setXrMotionReferenceCastMarkChoreography(update)}
          />
        </section>
      ) : null}
      {track.marks.map((mark, index) => {
        const percent = scaleDurationSeconds > 0 ? (mark.timeSeconds / scaleDurationSeconds) * 100 : 0
        const selected = runtime.selectedMark?.kind === 'cast'
          && runtime.selectedMark.actorId === track.actorId
          && runtime.selectedMark.markId === mark.id
        const selectMark = () => selectXrMotionReferenceCastMark(track.actorId, mark.id)
        return (
          <TimelineTransportTimeAxisMark
            key={mark.id}
            laneStyle="video"
            className="xr-camera-motion-retime-axis-mark"
            style={markAxisStyle(mark.timeSeconds, scaleDurationSeconds)}
            aria-label={`${track.label} mark ${index + 1} at ${mark.timeSeconds} seconds`}
            aria-pressed={selected}
            role="button"
            tabIndex={0}
            onClick={selectMark}
            onKeyDown={event => selectMarkOnKeyDown(event, selectMark)}
            data-kg-xr-retime-cast-mark={index + 1}
            data-kg-xr-retime-edge={percent > 72 ? 'end' : 'start'}
            data-kg-xr-stage-highlight-target={selected ? 'cast-mark' : undefined}
          >
            <span className="timeline-transport-track-clip-label xr-camera-motion-retime-axis-mark-label" style={{ backgroundColor: selected ? XR_MOTION_REFERENCE_SELECTION_COLOR : track.color }}>{index + 1}</span>
            <TimeEditor compact label={`${track.label} mark ${index + 1} time`} value={mark.timeSeconds} max={durationSeconds} onChange={value => retimeXrMotionReferenceCastMark(track.actorId, mark.id, value)} />
            <button type="button" className="App-toolbar__btn p-0.5" disabled={track.marks.length <= 1} aria-label={`Remove ${track.label} mark ${index + 1}`} onClick={event => {
              event.stopPropagation()
              removeXrMotionReferenceCastMark(track.actorId, mark.id)
            }}>
              <Trash2 className="size-3" aria-hidden />
            </button>
          </TimelineTransportTimeAxisMark>
        )
      })}
    </section>
  )
}

export function CameraMotionMarkRetime({ layout = 'panel' }: { layout?: 'panel' | 'time-axis' }) {
  const selectedNodeId = useGraphStore(state => state.selectedNodeId)
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const selectedActorId = React.useMemo(() => readBoundXrSelectedActorId(), [runtime, selectedNodeId])
  const selectedTrack = runtime.plan.cast.find(track => track.actorId === selectedActorId)
    || runtime.plan.cast[0]
    || null
  const timeAxis = layout === 'time-axis'
  const scaleDurationSeconds = resolveVideoSequenceTimelineScaleDurationSeconds(runtime.plan.durationSeconds)
  const warnings = React.useMemo(() => resolveXrChoreographySpeedWarnings(runtime.plan), [runtime.plan])
  const selectedCameraMark = runtime.plan.camera.find(mark => runtime.selectedMark?.kind === 'camera' && runtime.selectedMark.markId === mark.id)

  if (timeAxis) {
    return (
      <section
        className="xr-camera-motion-retime-axis"
        aria-label="XR mark retiming"
        data-kg-xr-timeline-retime="1"
        data-kg-xr-timeline-retime-layout={layout}
        data-kg-xr-timeline-retime-scale-seconds={scaleDurationSeconds}
        data-kg-xr-speed-warning-count={warnings.length}
      >
        {runtime.plan.cast.map(track => (
          <CastTrackTimeAxisRow
            key={track.actorId}
            durationSeconds={runtime.plan.durationSeconds}
            runtime={runtime}
            scaleDurationSeconds={scaleDurationSeconds}
            selectedActorId={selectedActorId}
            warnings={warnings}
            track={track}
          />
        ))}
        {runtime.plan.cast.length === 0 ? <section className="xr-camera-motion-retime-axis-row" aria-label="Cast mark times" data-kg-xr-retime-lane-ui="video"><p className="xr-camera-motion-retime-axis-empty">No cast track.</p></section> : null}
        <section className="xr-camera-motion-retime-axis-row" aria-label="Camera mark times" data-kg-xr-retime-lane-ui="audio">
          {selectedCameraMark ? (
            <section className="xr-camera-motion-retime-choreography" data-kg-xr-retime-camera-choreography={selectedCameraMark.id}>
              <XrChoreographyMarkControls
                compact
                target={{ kind: 'camera', mark: selectedCameraMark }}
                warning={warnings.find(warning => warning.targetKind === 'camera' && warning.fromMarkId === selectedCameraMark.id)}
                onChange={update => update.easing && setXrMotionReferenceCameraMarkEasing(update.markId, update.easing)}
              />
            </section>
          ) : null}
          {runtime.plan.camera.map((mark, index) => {
            const percent = scaleDurationSeconds > 0 ? (mark.timeSeconds / scaleDurationSeconds) * 100 : 0
            const selected = runtime.selectedMark?.kind === 'camera' && runtime.selectedMark.markId === mark.id
            const selectMark = () => selectXrMotionReferenceCameraMark(mark.id)
            return (
              <TimelineTransportTimeAxisMark
                key={mark.id}
                laneStyle="audio"
                className="xr-camera-motion-retime-axis-mark"
                style={markAxisStyle(mark.timeSeconds, scaleDurationSeconds)}
                title={mark.rig}
                aria-label={`Camera mark ${index + 1} at ${mark.timeSeconds} seconds · ${mark.rig}`}
                aria-pressed={selected}
                role="button"
                tabIndex={0}
                onClick={selectMark}
                onKeyDown={event => selectMarkOnKeyDown(event, selectMark)}
                data-kg-xr-retime-camera-mark={index + 1}
                data-kg-xr-retime-edge={percent > 72 ? 'end' : 'start'}
                data-kg-xr-stage-highlight-target={selected ? 'camera-mark' : undefined}
              >
                <span className="timeline-transport-track-clip-label xr-camera-motion-retime-axis-mark-label" style={selected ? { backgroundColor: XR_MOTION_REFERENCE_SELECTION_COLOR } : undefined}>C{index + 1}</span>
                <TimeEditor compact label={`Camera mark ${index + 1} time`} value={mark.timeSeconds} max={runtime.plan.durationSeconds} onChange={value => retimeXrMotionReferenceCameraMark(mark.id, value)} />
                <button type="button" className="App-toolbar__btn p-0.5" aria-label={`Remove camera mark ${index + 1}`} onClick={event => {
                  event.stopPropagation()
                  removeXrMotionReferenceCameraMark(mark.id)
                }}>
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </TimelineTransportTimeAxisMark>
            )
          })}
          {runtime.plan.camera.length === 0 ? <p className="xr-camera-motion-retime-axis-empty">Drop camera marks from Camera → SHOOT.</p> : null}
        </section>
      </section>
    )
  }

  return (
    <section
      className={cn('grid min-w-0 gap-1 rounded border p-1.5', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
      aria-label="XR mark retiming"
      data-kg-xr-timeline-retime="1"
      data-kg-xr-timeline-retime-layout={layout}
    >
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h4 className="text-[10px] font-semibold uppercase">Retime marks</h4>
        <p className={cn('m-0 text-[9px]', UI_THEME_TOKENS.text.tertiary)}>Seconds · actor + camera</p>
      </header>
      <section className="flex min-w-0 flex-wrap gap-1" aria-label="Cast mark times">
        {selectedTrack?.marks.map((mark, index) => (
          <article key={mark.id} className={cn('flex items-center gap-1 rounded border px-1 py-0.5', UI_THEME_TOKENS.panel.border)} data-kg-xr-retime-cast-mark={index + 1}>
            <span className="grid size-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: selectedTrack.color }}>{index + 1}</span>
            <TimeEditor label={`${selectedTrack.label} mark ${index + 1} time`} value={mark.timeSeconds} max={runtime.plan.durationSeconds} onChange={value => retimeXrMotionReferenceCastMark(selectedTrack.actorId, mark.id, value)} />
            <button type="button" className="App-toolbar__btn p-1" disabled={selectedTrack.marks.length <= 1} aria-label={`Remove ${selectedTrack.label} mark ${index + 1}`} onClick={() => removeXrMotionReferenceCastMark(selectedTrack.actorId, mark.id)}>
              <Trash2 className="size-3" aria-hidden />
            </button>
          </article>
        ))}
        {!selectedTrack ? <p className={cn('m-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>No cast track.</p> : null}
      </section>
      <section className="flex min-w-0 flex-wrap gap-1" aria-label="Camera mark times">
        {runtime.plan.camera.map((mark, index) => (
          <article key={mark.id} className={cn('flex items-center gap-1 rounded border px-1 py-0.5', UI_THEME_TOKENS.panel.border)} data-kg-xr-retime-camera-mark={index + 1}>
            <span className="text-[9px] font-bold">C{index + 1}</span>
            <TimeEditor label={`Camera mark ${index + 1} time`} value={mark.timeSeconds} max={runtime.plan.durationSeconds} onChange={value => retimeXrMotionReferenceCameraMark(mark.id, value)} />
            <span className={cn('max-w-16 truncate text-[9px]', UI_THEME_TOKENS.text.tertiary)} title={mark.rig}>{mark.rig}</span>
            <button type="button" className="App-toolbar__btn p-1" aria-label={`Remove camera mark ${index + 1}`} onClick={() => removeXrMotionReferenceCameraMark(mark.id)}>
              <Trash2 className="size-3" aria-hidden />
            </button>
          </article>
        ))}
        {runtime.plan.camera.length === 0 ? <p className={cn('m-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Drop camera marks from FloatingPanel → Camera → SHOOT.</p> : null}
      </section>
    </section>
  )
}
