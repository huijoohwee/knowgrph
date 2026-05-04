import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function useSchemaEditorUiClasses() {
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
  )
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s =>
      s.uiPanelMicroLabelTextSizeClass ||
      s.uiIconBadgeChipTextSizeClass ||
      'text-[9px]',
  )

  return {
    uiPanelKeyValueInputClass,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
  }
}
