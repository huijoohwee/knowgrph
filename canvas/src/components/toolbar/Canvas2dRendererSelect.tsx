import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CircleDot, GitMerge, Palette, Pencil } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { DropdownPanel } from '@/lib/ui/overlay'
import type { Canvas2dRendererId } from '@/lib/config'
import { UI_COPY } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiPrimaryChipActiveClassName, uiPrimaryIconActiveClassName, uiPrimaryIconInactiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
}

const MENU_WIDTH_CLASS = 'w-64'

export function Canvas2dRendererSelect({ iconSizeClass, iconStrokeWidth, ensureBaselineUnlocked, disabled }: Canvas2dRendererSelectProps) {
  const { canvas2dRenderer, setCanvas2dRenderer } = useGraphStore(
    useShallow(s => ({
      canvas2dRenderer: (s.canvas2dRenderer || 'd3') as Canvas2dRendererId,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
    })),
  )

  const [open, setOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

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

  const activeOption = options.find(o => o.id === canvas2dRenderer) || options[0]

  return (
    <>
      <IconButton
        ref={buttonRef}
        className={`App-toolbar__btn ${open ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName}`}
        title={activeOption.title}
        tooltipContent={UI_COPY.twoDRendererToggleTooltip}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        showTooltip
      >
        <div className="flex items-center gap-1">
          <activeOption.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          <span className="text-xs">{activeOption.label}</span>
        </div>
      </IconButton>

      {open && (
        <DropdownPanel anchorRef={buttonRef} open={open} onClose={() => setOpen(false)} align="bottom-center">
          <menu
            className={`p-1 flex flex-col gap-1 ${MENU_WIDTH_CLASS} list-none m-0 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md`}
            aria-label="2D renderer"
          >
            {options.map(option => {
              const isActive = option.id === canvas2dRenderer
              return (
                <li key={option.id} className="list-none">
                  <button
                    type="button"
                    className={`w-full flex items-center gap-2 rounded px-2 py-1 text-sm ${UI_THEME_TOKENS.text.primary} hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      isActive ? uiPrimaryChipActiveClassName : ''
                    }`}
                    onClick={() => {
                      if (!ensureBaselineUnlocked()) return
                      setCanvas2dRenderer(option.id)
                      setOpen(false)
                    }}
                    title={option.title}
                  >
                    <option.Icon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
                    <span className="truncate">{option.title}</span>
                  </button>
                </li>
              )
            })}
          </menu>
        </DropdownPanel>
      )}
    </>
  )
}

