import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { isPropsPanelWidgetPaletteEntry } from '@/features/storyboard-widget-manager/registryTemplates'
import WidgetPalette from '@/features/toolbar/WidgetPalette'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_FLOATING_PANEL_SUBPANEL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

export function FloatingPropsPanel() {
  const effectiveWidgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const widgetPaletteEntries = React.useMemo(
    () => (Array.isArray(effectiveWidgetRegistry) ? effectiveWidgetRegistry : []).filter(isPropsPanelWidgetPaletteEntry),
    [effectiveWidgetRegistry],
  )
  const widgetDragEnabled = widgetPaletteEntries.length > 0

  return (
    <section
      className={`${UI_RESPONSIVE_FLOATING_PANEL_SUBPANEL_CLASSNAME} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Props Panel"
      data-kg-props-panel-surface="widget-palette"
    >
      <WidgetPalette entries={widgetPaletteEntries} dragEnabled={widgetDragEnabled} />
    </section>
  )
}
