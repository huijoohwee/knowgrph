import React from 'react'
import { Hand, Maximize2, MousePointer, Redo, Undo } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { useGraphStore } from '@/hooks/useGraphStore'
import { dispatchRuntimeFitToViewSoon } from '@/lib/canvas/runtimeZoomDispatch'
import { UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { cn } from '@/lib/utils'

export function DesignCanvasEditorChrome(props: {
  active: boolean
  interactionActive: boolean
  selectedCount: number
  layerCount: number
}) {
  const {
    uiIconScale,
    uiIconStrokeWidth,
    canvasPointerMode2d,
    setCanvasPointerMode2d,
    canUndo,
    canRedo,
    undoDesignHistory,
    redoDesignHistory,
  } = useGraphStore(
    useShallow(s => ({
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      canvasPointerMode2d: s.canvasPointerMode2d,
      setCanvasPointerMode2d: s.setCanvasPointerMode2d,
      canUndo: s.canUndoDesignHistory(),
      canRedo: s.canRedoDesignHistory(),
      undoDesignHistory: s.undoDesignHistory,
      redoDesignHistory: s.redoDesignHistory,
    })),
  )

  if (!props.active) return null

  const iconSizeClass = getIconSizeClass(uiIconScale)
  const buttonClass = cn(
    'App-toolbar__btn',
    UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME,
    UI_THEME_TOKENS.button.hoverBg,
    UI_THEME_TOKENS.button.text,
    'h-8 w-8 justify-center p-0',
  )
  const activeButtonClass = cn(buttonClass, UI_THEME_TOKENS.button.activeText, UI_THEME_TOKENS.button.activeBg)
  const mode = canvasPointerMode2d === 'pan' ? 'Pan' : 'Select'

  return (
    <div className="pointer-events-none absolute inset-x-2 top-[calc(var(--kg-safe-top)+6.75rem)] z-30 flex min-w-0 items-start gap-2" aria-label="Design editor chrome">
      <nav
        className={cn('pointer-events-auto flex shrink-0 flex-col gap-1 rounded border p-1 shadow-sm', UI_THEME_TOKENS.panel.overlayBg, UI_THEME_TOKENS.panel.border)}
        aria-label="Design tools"
      >
        <button
          type="button"
          className={canvasPointerMode2d === 'select' ? activeButtonClass : buttonClass}
          onClick={() => props.interactionActive && setCanvasPointerMode2d('select')}
          title="Select tool"
          aria-label="Select tool"
          disabled={!props.interactionActive}
        >
          <MousePointer className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
        <button
          type="button"
          className={canvasPointerMode2d === 'pan' ? activeButtonClass : buttonClass}
          onClick={() => props.interactionActive && setCanvasPointerMode2d('pan')}
          title="Pan tool"
          aria-label="Pan tool"
          disabled={!props.interactionActive}
        >
          <Hand className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
        <span className={cn('mx-1 h-px', UI_THEME_TOKENS.panel.border)} aria-hidden={true} />
        <button
          type="button"
          className={buttonClass}
          onClick={() => props.interactionActive && undoDesignHistory()}
          title="Undo"
          aria-label="Undo"
          disabled={!props.interactionActive || !canUndo}
        >
          <Undo className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => props.interactionActive && redoDesignHistory()}
          title="Redo"
          aria-label="Redo"
          disabled={!props.interactionActive || !canRedo}
        >
          <Redo className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => props.interactionActive && dispatchRuntimeFitToViewSoon()}
          title="Fit to view"
          aria-label="Fit to view"
          disabled={!props.interactionActive}
        >
          <Maximize2 className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </button>
      </nav>
      <div
        className={cn(
          'pointer-events-none flex min-w-0 max-w-[calc(100%-3rem)] items-center gap-2 rounded border px-2 py-1 shadow-sm',
          UI_THEME_TOKENS.panel.overlayBg,
          UI_THEME_TOKENS.panel.border,
          UI_THEME_TOKENS.text.tertiary,
        )}
        aria-label="Design status"
      >
        <span className={cn('text-[10px] font-semibold', UI_THEME_TOKENS.text.primary)}>Design</span>
        <span className="font-mono text-[10px]">{mode}</span>
        <span className="font-mono text-[10px]">{props.selectedCount} selected</span>
        <span className="hidden font-mono text-[10px] sm:inline">{props.layerCount} layers</span>
      </div>
    </div>
  )
}
