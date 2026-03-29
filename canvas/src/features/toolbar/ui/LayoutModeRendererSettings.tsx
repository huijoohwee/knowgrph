import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import { readLayoutMode2d, type LayoutMode2d } from '@/lib/graph/layoutMode'

const LAYOUT_MODE_OPTIONS: Array<{ value: LayoutMode2d; label: string }> = [
  { value: 'radial', label: 'Radial (default)' },
  { value: 'block', label: 'Block' },
]

export function LayoutModeRendererSettings(props: {
  selectedLayoutMode?: LayoutMode2d
  onSelectLayoutMode?: (next: LayoutMode2d) => void
  disabled?: boolean
}) {
  const onSelectLayoutModeProp = props.onSelectLayoutMode
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || '')
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-xs')
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const layoutMode = readLayoutMode2d(schema)
  const selectedLayoutMode = props.selectedLayoutMode ?? layoutMode
  const disabled = props.disabled === true

  const setLayoutMode = React.useCallback((next: LayoutMode2d) => {
    const current = useGraphStore.getState().schema as GraphSchema
    const layout = current.layout || {}
    setSchema({
      ...current,
      layout: {
        ...layout,
        mode: next,
      },
    })
  }, [setSchema])

  const onSelectLayoutMode = React.useCallback((next: LayoutMode2d) => {
    if (onSelectLayoutModeProp) {
      onSelectLayoutModeProp(next)
      return
    }
    setLayoutMode(next)
  }, [onSelectLayoutModeProp, setLayoutMode])

  return (
    <CollapsibleSection title="Layout" defaultCollapsed={false} stickyHeader={false} headerClassName={`px-2 ${uiPanelTextFontClass}`}>
      <div className="px-3 py-2 space-y-2">
        <div className={`text-[10px] ${UI_THEME_TOKENS.text.secondary} leading-snug`}>
          Global layout mode shared across 2D/3D renderers and semantic views.
        </div>
        <div className="flex items-center gap-2">
          <label className={`w-[50%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}>
            Mode
          </label>
          <select
            className={`w-[50%] h-6 px-2 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded`}
            value={selectedLayoutMode}
            disabled={disabled}
            onChange={e => onSelectLayoutMode((String(e.target.value || '').trim().toLowerCase() === 'block' ? 'block' : 'radial'))}
          >
            {LAYOUT_MODE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </CollapsibleSection>
  )
}
