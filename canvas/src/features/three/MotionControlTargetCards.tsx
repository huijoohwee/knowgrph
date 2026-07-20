import React from 'react'
import { Box, Clapperboard } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { renderAgenticOsInvocationKeywordChip } from '@/features/agentic-os/agenticOsInvocationChips'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_INLINE_CHIP_GROUP_CLASSNAME } from '@/lib/ui/textLayout'
import { cn } from '@/lib/utils'
import {
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from './xrMotionReferenceRuntime'
import {
  readXrNativeControllerDemo,
  subscribeXrNativeControllerDemo,
} from './xrNativeControllerDemoRuntime'
import { inspectMotionControlTargets } from './motionControlTargetRuntime'
import type { MotionControlCompanionTarget } from './motionControlSurfaceRuntime'

type MotionControlTargetCardsProps = Readonly<{
  running: boolean
  onOpenTarget: (target: MotionControlCompanionTarget) => void
}>

function TargetInvocation({ invocation }: { invocation: string }) {
  return (
    <code
      className={cn(UI_INLINE_CHIP_GROUP_CLASSNAME, 'min-w-0 overflow-hidden font-mono text-[9px]', UI_THEME_TOKENS.text.secondary)}
      data-kg-motion-control-target-invocation="shared-canonical"
    >
      {renderMarkdownSigilInlineText(invocation, {
        renderKeywordChip: ({ value, className }) => renderAgenticOsInvocationKeywordChip({ value, className, sourceLink: false }),
      })}
    </code>
  )
}

export const MotionControlTargetCards = React.memo(function MotionControlTargetCards({
  running,
  onOpenTarget,
}: MotionControlTargetCardsProps) {
  const runtime = React.useSyncExternalStore(
    subscribeXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
    readXrMotionReferenceRuntime,
  )
  const controller = React.useSyncExternalStore(
    subscribeXrNativeControllerDemo,
    readXrNativeControllerDemo,
    readXrNativeControllerDemo,
  )
  const selectedNodeId = useGraphStore(state => state.selectedNodeId)
  const targets = React.useMemo(inspectMotionControlTargets, [controller.revision, runtime.revision, selectedNodeId])
  const selected = targets.selectedHumanoid
  const xr3d = targets.surfaces.xr3d
  const animation = targets.surfaces.animation
  const animationStatus = !animation.sceneReady
    ? 'Open or create a graph document to control XR animation.'
    : selected.compatible
      ? `${selected.label || selected.actorId} · ${running ? 'live pose override' : 'ready for live pose'}`
      : 'Select a humanoid cast target in 3D for XR or Animation.'

  return (
    <section className="grid gap-2" aria-label="Motion Control XR targets" data-kg-motion-control-targets="shared-xr-owners">
      <article className={cn('grid gap-1 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-motion-control-target="xr-3d">
        <header className="flex items-center gap-2">
          <Box className="size-4" aria-hidden="true" />
          <h3 className="text-[11px] font-semibold">3D for XR</h3>
          <button type="button" className="App-toolbar__btn ml-auto" onClick={() => onOpenTarget('xr-3d')} data-kg-motion-control-open-target="xr-3d">Open</button>
        </header>
        <p className={cn('text-[10px]', UI_THEME_TOKENS.text.secondary)}>
          {xr3d.sceneReady
            ? `${xr3d.subjectCount} staged · controller ${xr3d.controllerPhase} (${xr3d.controllerMode})`
            : 'Open or create a graph document to control the XR scene.'}
        </p>
        <p className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Live pose feeds the selected XR humanoid and the native physics controller without writing camera frames or pose history.</p>
        <TargetInvocation invocation={xr3d.invocation} />
        <p className={cn('truncate text-[9px]', UI_THEME_TOKENS.text.tertiary)}>WebMCP · {xr3d.webMcpTool}</p>
      </article>

      <article className={cn('grid gap-1 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-motion-control-target="animation">
        <header className="flex items-center gap-2">
          <Clapperboard className="size-4" aria-hidden="true" />
          <h3 className="text-[11px] font-semibold">Animation</h3>
          <button type="button" className="App-toolbar__btn ml-auto" onClick={() => onOpenTarget('animation')} data-kg-motion-control-open-target="animation">Open</button>
        </header>
        <p className={cn('text-[10px]', animation.sceneReady && selected.compatible ? UI_THEME_TOKENS.text.secondary : UI_THEME_TOKENS.status.warning)}>{animationStatus}</p>
        <p className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Live pose overrides only the selected character pose; authored path marks and the assigned preset remain and resume after Stop.</p>
        <TargetInvocation invocation={animation.invocation} />
        <p className={cn('truncate text-[9px]', UI_THEME_TOKENS.text.tertiary)}>WebMCP · {animation.webMcpTool}</p>
      </article>
    </section>
  )
})
