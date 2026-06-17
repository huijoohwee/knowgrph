import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME } from 'grph-shared/ui/keyTypeValueRows'

export interface CanvasKeyTypeValueRuntime {
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
  uiPanelRowDensityDefaultClass: string
  uiPanelRowDensityCompactClass: string
}

export interface CanvasKeyTypeValueStaticRowSharedProps {
  textSizeClassName: string
  fontClassName: string
  densityClassName: string
  activeClassName: string
}

export const resolveCanvasKeyTypeValueDensityClassName = (
  runtime: CanvasKeyTypeValueRuntime,
  density: 'default' | 'compact' = 'default',
): string =>
  density === 'compact'
    ? runtime.uiPanelRowDensityCompactClass
    : runtime.uiPanelRowDensityDefaultClass

export function useCanvasKeyTypeValueRuntime(): CanvasKeyTypeValueRuntime {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelRowDensityDefaultClass = useGraphStore(
    s => s.uiPanelRowDensityDefaultClass || 'py-1',
  )
  const uiPanelRowDensityCompactClass = useGraphStore(
    s => s.uiPanelRowDensityCompactClass || 'py-0.5',
  )

  return {
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    uiPanelRowDensityDefaultClass,
    uiPanelRowDensityCompactClass,
  }
}

export function useCanvasKeyTypeValueStaticRowProps(
  density: 'default' | 'compact' = 'default',
  activeClassName = UI_THEME_TOKENS.table.rowHoverHighlight,
): CanvasKeyTypeValueStaticRowSharedProps {
  const runtime = useCanvasKeyTypeValueRuntime()
  const densityClassName = resolveCanvasKeyTypeValueDensityClassName(runtime, density)

  return React.useMemo(() => ({
    textSizeClassName: runtime.uiPanelKeyValueTextSizeClass,
    fontClassName: runtime.uiPanelTextFontClass,
    densityClassName,
    activeClassName,
  }), [
    activeClassName,
    densityClassName,
    runtime.uiPanelKeyValueTextSizeClass,
    runtime.uiPanelTextFontClass,
  ])
}
