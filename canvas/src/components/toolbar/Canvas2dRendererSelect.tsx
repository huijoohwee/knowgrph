import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CircleDot, GitMerge, Palette, Pencil, Columns2 } from 'lucide-react'
import type { Canvas2dRendererId } from '@/lib/config'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'

type Canvas2dRendererSelectProps = {
  iconSizeClass: string
  iconStrokeWidth: number
  ensureBaselineUnlocked: () => boolean
  disabled?: boolean
}

type RendererOption = {
  id: Canvas2dRendererId
  title: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  label: string
  disabledReason?: string
  enableHint?: string
}


export function Canvas2dRendererSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked, disabled }: Canvas2dRendererSelectProps) {
  const { canvas2dRenderer, setCanvas2dRenderer, layoutMode } = useGraphStore(
    useShallow(s => ({
      canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
      layoutMode: s.schema?.layout?.mode,
    })),
  )

  const options = React.useMemo(
    () =>
      [
        {
          id: 'd3' as const,
          title: UI_COPY.twoDRendererD3Title,
          Icon: CircleDot,
          label: 'D3',
        },
        {
          id: 'd3Bipartite' as const,
          title: UI_COPY.twoDRendererD3BipartiteTitle,
          Icon: Columns2,
          label: 'Bi',
        },
        {
          id: 'flow' as const,
          title: UI_COPY.twoDRendererFlowTitle,
          Icon: GitMerge,
          label: 'Flow',
        },
        {
          id: 'design' as const,
          title: UI_COPY.twoDRendererDesignTitle,
          Icon: Palette,
          label: 'Design',
        },
        {
          id: 'flowEditor' as const,
          title: UI_COPY.twoDRendererFlowEditorTitle,
          Icon: Pencil,
          label: 'Edit',
        },
      ] satisfies RendererOption[],
    [],
  )

  const optionsWithDisabled = React.useMemo(
    () =>
      options.map(option => {
        const disabledForRadial =
          layoutMode === 'radial' &&
          option.id !== 'd3' &&
          option.id !== 'd3Bipartite'
        return {
          ...option,
          disabled: disabledForRadial,
          disabledReason: disabledForRadial ? 'Disabled in Radial Layout' : undefined,
          enableHint: disabledForRadial ? 'Switch layout mode to Block to enable' : undefined,
        }
      }),
    [layoutMode, options],
  )

  return (
    <ToolbarDropdownSelect
      value={canvas2dRenderer}
      options={optionsWithDisabled}
      title={(options.find(o => o.id === canvas2dRenderer) || options[0]).title}
      tooltipContent={UI_COPY.twoDRendererToggleTooltip}
      disabled={disabled}
      onSelect={id => {
        if (!ensureBaselineUnlocked()) return
        setCanvas2dRenderer(id)
      }}
      renderButtonContent={activeOption => (
        <div className="flex items-center gap-1">
          <activeOption.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">{activeOption.label}</span>
        </div>
      )}
      renderOptionContent={option => (
        <>
          <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="truncate">{option.title}</span>
        </>
      )}
      menuWidthClass="w-64"
    />
  )
}
