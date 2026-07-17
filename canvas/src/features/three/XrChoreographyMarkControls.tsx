import React from 'react'
import { TriangleAlert } from 'lucide-react'
import { PanelSelect } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  XR_CHOREOGRAPHY_EASINGS,
  XR_CHOREOGRAPHY_GAITS,
  type XrChoreographyEasing,
  type XrChoreographyGait,
  type XrMotionReferenceCameraMark,
  type XrMotionReferenceMark,
} from './xrMotionReferenceModel'
import type { XrChoreographySpeedWarning } from './xrChoreographyDiagnostics'

export type XrChoreographyMarkUpdate =
  | Readonly<{ kind: 'cast'; actorId: string; markId: string; easing?: XrChoreographyEasing; gait?: XrChoreographyGait }>
  | Readonly<{ kind: 'camera'; markId: string; easing?: XrChoreographyEasing }>

type Props = Readonly<{
  target: Readonly<{ kind: 'cast'; actorId: string; mark: XrMotionReferenceMark }>
    | Readonly<{ kind: 'camera'; mark: XrMotionReferenceCameraMark }>
  warning?: XrChoreographySpeedWarning
  compact?: boolean
  onChange: (update: XrChoreographyMarkUpdate) => void
}>

export function XrChoreographyMarkControls({ target, warning, compact = false, onChange }: Props) {
  const easing = target.kind === 'cast' ? target.mark.transition : target.mark.easing
  const selectClass = compact ? 'h-5 w-[76px] px-1 py-0 text-[9px]' : 'h-7 min-w-0 text-[10px]'
  return (
    <section
      className={cn('flex min-w-0 items-center gap-1', compact ? '' : 'flex-wrap')}
      aria-label={`${target.kind === 'cast' ? 'Cast' : 'Camera'} mark choreography`}
      data-kg-xr-choreography-mark-controls={target.kind}
    >
      <label className="grid min-w-0 gap-0.5 text-[9px]">
        {!compact ? <span className={UI_THEME_TOKENS.text.tertiary}>Easing</span> : null}
        <PanelSelect
          className={selectClass}
          aria-label={`${target.kind === 'cast' ? 'Cast' : 'Camera'} mark easing`}
          value={easing}
          onChange={event => onChange({
            kind: target.kind,
            ...(target.kind === 'cast' ? { actorId: target.actorId } : {}),
            markId: target.mark.id,
            easing: event.target.value as XrChoreographyEasing,
          } as XrChoreographyMarkUpdate)}
          data-kg-xr-mark-easing={target.mark.id}
        >
          {XR_CHOREOGRAPHY_EASINGS.map(value => <option key={value} value={value}>{value}</option>)}
        </PanelSelect>
      </label>
      {target.kind === 'cast' ? (
        <label className="grid min-w-0 gap-0.5 text-[9px]">
          {!compact ? <span className={UI_THEME_TOKENS.text.tertiary}>Gait</span> : null}
          <PanelSelect
            className={selectClass}
            aria-label="Cast mark gait"
            value={target.mark.gait}
            onChange={event => onChange({ kind: 'cast', actorId: target.actorId, markId: target.mark.id, gait: event.target.value as XrChoreographyGait })}
            data-kg-xr-mark-gait={target.mark.id}
          >
            {XR_CHOREOGRAPHY_GAITS.map(value => <option key={value} value={value}>{value}</option>)}
          </PanelSelect>
        </label>
      ) : null}
      {warning ? (
        <output className="flex min-w-0 items-center gap-1 text-[9px] text-amber-700 dark:text-amber-300" title={warning.message} data-kg-xr-speed-warning={warning.code}>
          <TriangleAlert className="size-3 shrink-0" aria-hidden />
          {!compact ? <span className="truncate">{warning.message}</span> : null}
        </output>
      ) : null}
    </section>
  )
}
