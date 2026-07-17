import React from 'react'
import { Trash2 } from 'lucide-react'
import { PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  readXrMotionReferenceRuntime,
  removeXrMotionReferenceCameraMark,
  removeXrMotionReferenceCastMark,
  retimeXrMotionReferenceCameraMark,
  retimeXrMotionReferenceCastMark,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'

function TimeEditor({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <PanelTextInput
      className="h-6 w-16 px-1 text-[10px]"
      aria-label={label}
      type="number"
      min={0}
      max={max}
      step={0.05}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
    />
  )
}

export function CameraMotionMarkRetime() {
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const selectedTrack = runtime.plan.cast.find(track => track.actorId === runtime.selectedActorId)
    || runtime.plan.cast[0]
    || null

  return (
    <section
      className={cn('grid gap-1 rounded border p-1.5', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
      aria-label="XR mark retiming"
      data-kg-xr-timeline-retime="1"
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
