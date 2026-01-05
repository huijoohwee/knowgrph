import { useGraphStore } from '@/hooks/useGraphStore'

export function useSchemaEditorUiClasses() {
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
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

