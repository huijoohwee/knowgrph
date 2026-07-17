import React from 'react'
import { Camera, Footprints, type LucideIcon } from 'lucide-react'
import {
  FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT,
  floatingPanelCatalogThreeRowClassName,
  floatingPanelCatalogThreeRowThumbnailFrameClassName,
} from '@/lib/ui/floatingPanelCatalogLayout'
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

function ChoreographyCard({
  Icon,
  children,
  description,
  footer,
  metadata,
  target,
  title,
}: {
  Icon: LucideIcon
  children?: React.ReactNode
  description: string
  footer: React.ReactNode
  metadata: string
  target: 'cast' | 'camera'
  title: string
}) {
  return (
    <article
      className={floatingPanelCatalogThreeRowClassName('cursor-default')}
      data-kg-xr-choreography-card={target}
      data-kg-xr-choreography-card-layout={FLOATING_PANEL_CATALOG_THREE_ROW_LAYOUT}
    >
      <span
        className={floatingPanelCatalogThreeRowThumbnailFrameClassName('items-center justify-center')}
        role="img"
        aria-label={`${title} choreography path`}
      >
        <Icon className={cn('size-8', UI_THEME_TOKENS.text.tertiary)} strokeWidth={1.45} aria-hidden />
      </span>
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1">
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-xr-choreography-card-row="title">
          <h3 className="truncate text-xs font-semibold" title={title}>{title}</h3>
        </header>
        <section className="grid min-w-0 gap-0.5" data-kg-xr-choreography-card-row="meta">
          <p className={cn('m-0 line-clamp-2 text-[11px]', UI_THEME_TOKENS.text.secondary)}>{description}</p>
          <p className={cn('m-0 truncate text-[10px] uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary)}>{metadata}</p>
        </section>
        <footer className="flex min-w-0 items-center gap-1 overflow-x-auto" data-kg-xr-choreography-card-row="action">{footer}</footer>
      </section>
      {children ? (
        <section className={cn('col-span-2 grid gap-1 border-t pt-2', UI_THEME_TOKENS.panel.border)} data-kg-xr-choreography-card-row="controls">
          {children}
        </section>
      ) : null}
    </article>
  )
}

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
  const castMarkIndex = castMark ? track?.marks.findIndex(mark => mark.id === castMark.id) ?? -1 : -1
  const cameraMarkIndex = cameraMark ? runtime.plan.camera.findIndex(mark => mark.id === cameraMark.id) : -1

  return (
    <section className="grid gap-2" aria-label="Choreography" data-kg-xr-choreography-inspector="shared-runtime">
      <header className="flex items-center justify-between gap-2">
        <section className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase">Choreography</h2>
          <p className={cn('m-0 text-[9px]', UI_THEME_TOKENS.text.tertiary)}>One mark model for cast and camera · Timeline owns time</p>
        </section>
        <output className={cn('text-[9px]', warnings.length ? 'text-amber-700 dark:text-amber-300' : UI_THEME_TOKENS.text.tertiary)} data-kg-xr-speed-warning-count={warnings.length}>{warnings.length ? `${warnings.length} speed warning${warnings.length === 1 ? '' : 's'}` : 'Speed sane'}</output>
      </header>
      {track && castMark ? (
        <ChoreographyCard
          Icon={Footprints}
          target="cast"
          title={track.label}
          description="Editable cast path. Select a mark, then tune easing and gait."
          metadata={`${track.marks.length} mark${track.marks.length === 1 ? '' : 's'} · mark ${castMarkIndex + 1} · ${castMark.timeSeconds}s`}
          footer={(
            <>
              {track.marks.map((mark, index) => (
                <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={castMark.id === mark.id} aria-label={`Select ${track.label} mark ${index + 1}`} onClick={() => selectXrMotionReferenceCastMark(track.actorId, mark.id)}>{index + 1}</button>
              ))}
            </>
          )}
        >
          <XrChoreographyMarkControls target={{ kind: 'cast', actorId: track.actorId, mark: castMark }} warning={castWarning} onChange={onChange} />
        </ChoreographyCard>
      ) : (
        <ChoreographyCard Icon={Footprints} target="cast" title="Cast path" description="Select a cast actor to edit its path choreography." metadata="No cast target selected" footer={<span className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Choose a cast target above.</span>} />
      )}
      {cameraMark ? (
        <ChoreographyCard
          Icon={Camera}
          target="camera"
          title="Camera path"
          description="Editable shot path. Select a mark, then tune its easing."
          metadata={`${runtime.plan.camera.length} mark${runtime.plan.camera.length === 1 ? '' : 's'} · ${cameraMark.rig} · mark ${cameraMarkIndex + 1} · ${cameraMark.timeSeconds}s`}
          footer={(
            <>
              {runtime.plan.camera.map((mark, index) => (
                <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={cameraMark.id === mark.id} aria-label={`Select camera mark ${index + 1}`} onClick={() => selectXrMotionReferenceCameraMark(mark.id)}>C{index + 1}</button>
              ))}
            </>
          )}
        >
          <XrChoreographyMarkControls target={{ kind: 'camera', mark: cameraMark }} warning={cameraWarning} onChange={onChange} />
        </ChoreographyCard>
      ) : (
        <ChoreographyCard Icon={Camera} target="camera" title="Camera path" description="Add camera marks in Camera → SHOOT; they share this easing model." metadata="0 marks · Timeline owns time" footer={<span className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>No camera marks yet.</span>} />
      )}
    </section>
  )
}
