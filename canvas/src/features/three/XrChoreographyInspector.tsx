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

function MarkParameterChips({ target }: { target: 'cast' | 'camera' }) {
  const chips = [
    { sigil: '/', label: 'Command parameter' },
    { sigil: '#', label: target === 'cast' ? 'Action-path parameter' : 'Camera parameter' },
    { sigil: '@', label: target === 'cast' ? 'Selected-actor parameter' : 'Camera target parameter' },
  ] as const
  return (
    <section
      className="flex min-w-0 items-center gap-1"
      aria-label={`${target === 'cast' ? 'Cast' : 'Camera'} mark parameters supported in BottomPanel Timeline`}
      data-kg-xr-mark-parameter-chips={target}
    >
      <span className={cn('mr-auto truncate text-[9px]', UI_THEME_TOKENS.text.tertiary)}>Edit parameters in Timeline</span>
      {chips.map(chip => (
        <span
          key={chip.sigil}
          className={cn('grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] font-semibold', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.text.secondary)}
          title={`${chip.label} · supported by BottomPanel Timeline mark control`}
          aria-label={chip.label}
          data-kg-xr-mark-parameter-sigil={chip.sigil}
        >
          {chip.sigil}
        </span>
      ))}
    </section>
  )
}

function ChoreographyCard({
  Icon,
  children,
  description,
  footer,
  invocation,
  metadata,
  target,
  title,
}: {
  Icon: LucideIcon
  children?: React.ReactNode
  description: string
  footer: React.ReactNode
  invocation: string
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
      <section className={cn('col-span-2 grid gap-1 border-t pt-2', UI_THEME_TOKENS.panel.border)} data-kg-xr-choreography-card-row="controls">
        {children}
        <output
          className={cn('truncate font-mono text-[9px]', UI_THEME_TOKENS.text.tertiary)}
          title={invocation}
          data-kg-xr-choreography-card-row="invocation"
          data-kg-xr-choreography-invocation={target}
        >
          {invocation}
        </output>
      </section>
    </article>
  )
}

export function XrChoreographyInspector({
  cameraInvocation,
  castInvocation,
  controlTool,
  invocationReady,
  runtime,
  selectedActorId,
}: {
  cameraInvocation: string
  castInvocation: string
  controlTool: string
  invocationReady: boolean
  runtime: XrMotionReferenceRuntimeSnapshot
  selectedActorId: string
}) {
  const warnings = React.useMemo(() => resolveXrChoreographySpeedWarnings(runtime.plan), [runtime.plan])
  const track = runtime.plan.cast.find(candidate => candidate.actorId === selectedActorId) || null
  const castMark = track?.marks.find(mark => runtime.selectedMark?.kind === 'cast'
    && runtime.selectedMark.actorId === track.actorId
    && runtime.selectedMark.markId === mark.id) || track?.marks[0]
  const cameraMark = runtime.plan.camera.find(mark => runtime.selectedMark?.kind === 'camera'
    && runtime.selectedMark.markId === mark.id) || runtime.plan.camera[0]
  const castMarkIndex = castMark ? track?.marks.findIndex(mark => mark.id === castMark.id) ?? -1 : -1
  const cameraMarkIndex = cameraMark ? runtime.plan.camera.findIndex(mark => mark.id === cameraMark.id) : -1
  const projectedCastInvocation = castMark
    ? castInvocation
      .replace('<typed-id>', castMark.id)
      .replace('<typed-easing>', castMark.transition)
      .replace('<typed-gait>', castMark.gait)
      .replace('<x,y,z>', castMark.position.join(','))
    : castInvocation
  const projectedCameraInvocation = cameraMark
    ? cameraInvocation
      .replace('<typed-id>', cameraMark.id)
      .replace('<typed-easing>', cameraMark.easing)
    : cameraInvocation

  return (
    <section className="grid gap-2" aria-label="Choreography" data-kg-xr-choreography-inspector="shared-runtime">
      <header className="flex items-center justify-between gap-2">
        <section className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase">Choreography</h2>
          <p className={cn('m-0 text-[9px]', UI_THEME_TOKENS.text.tertiary)}>One mark model for cast and camera · Timeline owns time</p>
        </section>
        <section className="grid shrink-0 justify-items-end gap-0.5">
          <output className={cn('text-[9px]', warnings.length ? 'text-amber-700 dark:text-amber-300' : UI_THEME_TOKENS.text.tertiary)} data-kg-xr-speed-warning-count={warnings.length}>{warnings.length ? `${warnings.length} speed warning${warnings.length === 1 ? '' : 's'}` : 'Speed sane'}</output>
          <output
            className={cn('text-[9px]', invocationReady ? 'text-emerald-700 dark:text-emerald-300' : UI_THEME_TOKENS.text.tertiary)}
            title={controlTool}
            data-kg-xr-choreography-runtime-ready={invocationReady ? '1' : '0'}
            data-kg-xr-choreography-mcp={controlTool}
          >
            {invocationReady ? 'MCP · / @ # ready' : 'Invocation catalog hydrating'}
          </output>
        </section>
      </header>
      {track && castMark ? (
        <ChoreographyCard
          Icon={Footprints}
          target="cast"
          title={track.label}
          description="Select a mark here; edit time, easing, gait, and XYZ in BottomPanel Timeline."
          invocation={projectedCastInvocation}
          metadata={`${track.marks.length} mark${track.marks.length === 1 ? '' : 's'} · mark ${castMarkIndex + 1} · ${castMark.timeSeconds}s`}
          footer={(
            <>
              {track.marks.map((mark, index) => (
                <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={castMark.id === mark.id} aria-label={`Select ${track.label} mark ${index + 1}`} onClick={() => selectXrMotionReferenceCastMark(track.actorId, mark.id)}>{index + 1}</button>
              ))}
            </>
          )}
        >
          <MarkParameterChips target="cast" />
        </ChoreographyCard>
      ) : (
        <ChoreographyCard Icon={Footprints} target="cast" title="Cast path" description="Select a cast actor to edit its path choreography." invocation={castInvocation || controlTool} metadata="No cast target selected" footer={<span className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Choose a cast target above.</span>}>
          <MarkParameterChips target="cast" />
        </ChoreographyCard>
      )}
      {cameraMark ? (
        <ChoreographyCard
          Icon={Camera}
          target="camera"
          title="Camera path"
          description="Select a mark here; edit time and easing in BottomPanel Timeline. Frame in Camera → SHOOT."
          invocation={projectedCameraInvocation}
          metadata={`${runtime.plan.camera.length} mark${runtime.plan.camera.length === 1 ? '' : 's'} · ${cameraMark.rig} · mark ${cameraMarkIndex + 1} · ${cameraMark.timeSeconds}s`}
          footer={(
            <>
              {runtime.plan.camera.map((mark, index) => (
                <button key={mark.id} type="button" className="App-toolbar__btn size-6 shrink-0 p-0 text-[9px]" aria-pressed={cameraMark.id === mark.id} aria-label={`Select camera mark ${index + 1}`} onClick={() => selectXrMotionReferenceCameraMark(mark.id)}>C{index + 1}</button>
              ))}
            </>
          )}
        >
          <MarkParameterChips target="camera" />
        </ChoreographyCard>
      ) : (
        <ChoreographyCard Icon={Camera} target="camera" title="Camera path" description="Add camera marks in Camera → SHOOT; edit them in BottomPanel Timeline." invocation={cameraInvocation || controlTool} metadata="0 marks · Timeline owns time" footer={<span className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>No camera marks yet.</span>}>
          <MarkParameterChips target="camera" />
        </ChoreographyCard>
      )}
    </section>
  )
}
