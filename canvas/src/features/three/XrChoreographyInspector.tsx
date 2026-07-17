import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { resolveXrChoreographySpeedWarnings } from './xrChoreographyDiagnostics'
import {
  selectXrMotionReferenceCameraMark,
  selectXrMotionReferenceCastMark,
  type XrMotionReferenceRuntimeSnapshot,
} from './xrMotionReferenceRuntime'
import {
  XrChoreographyMarkControls,
  type XrChoreographyMarkUpdate,
} from './XrChoreographyMarkControls'

export function XrChoreographyInspector({
  runtime,
  selectedActorId,
  onChange,
}: {
  runtime: XrMotionReferenceRuntimeSnapshot
  selectedActorId: string
  onChange: (update: XrChoreographyMarkUpdate) => void
}) {
  const warnings = React.useMemo(() => resolveXrChoreographySpeedWarnings(runtime.plan), [runtime.plan])
  const track = runtime.plan.cast.find(candidate => candidate.actorId === selectedActorId) || null
  const castMark = track?.marks.find(mark => runtime.selectedMark?.kind === 'cast'
    && runtime.selectedMark.actorId === track.actorId
    && runtime.selectedMark.markId === mark.id) || track?.marks[0]
  const cameraMark = runtime.plan.camera.find(mark => runtime.selectedMark?.kind === 'camera'
    && runtime.selectedMark.markId === mark.id) || runtime.plan.camera[0]
  const castWarning = castMark ? warnings.find(warning => warning.targetKind === 'cast' && warning.fromMarkId === castMark.id) : undefined
  const cameraWarning = cameraMark ? warnings.find(warning => warning.targetKind === 'camera' && warning.fromMarkId === cameraMark.id) : undefined

  return (
    <section className={cn('grid gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} aria-label="Choreography" data-kg-xr-choreography-inspector="shared-runtime">
      <header className="flex items-center justify-between gap-2">
        <section className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase">Choreography</h2>
          <p className={cn('m-0 text-[9px]', UI_THEME_TOKENS.text.tertiary)}>One mark model for cast and camera · Timeline owns time</p>
        </section>
        <output className={cn('text-[9px]', warnings.length ? 'text-amber-700 dark:text-amber-300' : UI_THEME_TOKENS.text.tertiary)} data-kg-xr-speed-warning-count={warnings.length}>{warnings.length ? `${warnings.length} speed warning${warnings.length === 1 ? '' : 's'}` : 'Speed sane'}</output>
      </header>
      {track && castMark ? (
        <section className="grid gap-1" aria-label="Cast path choreography">
          <header className="flex items-center gap-1 overflow-x-auto">
            <strong className="mr-1 text-[10px]">{track.label}</strong>
            {track.marks.map((mark, index) => (
              <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={castMark.id === mark.id} aria-label={`Select ${track.label} mark ${index + 1}`} onClick={() => selectXrMotionReferenceCastMark(track.actorId, mark.id)}>{index + 1}</button>
            ))}
          </header>
          <XrChoreographyMarkControls target={{ kind: 'cast', actorId: track.actorId, mark: castMark }} warning={castWarning} onChange={onChange} />
        </section>
      ) : <p className={cn('m-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Select a cast actor to edit its path.</p>}
      {cameraMark ? (
        <section className="grid gap-1 border-t pt-2" aria-label="Camera path choreography">
          <header className="flex items-center gap-1 overflow-x-auto">
            <strong className="mr-1 text-[10px]">Camera</strong>
            {runtime.plan.camera.map((mark, index) => (
              <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={cameraMark.id === mark.id} aria-label={`Select camera mark ${index + 1}`} onClick={() => selectXrMotionReferenceCameraMark(mark.id)}>C{index + 1}</button>
            ))}
          </header>
          <XrChoreographyMarkControls target={{ kind: 'camera', mark: cameraMark }} warning={cameraWarning} onChange={onChange} />
        </section>
      ) : <p className={cn('m-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Add camera marks in Camera → SHOOT; they share this easing model.</p>}
    </section>
  )
}
