import { useGraphStore } from '@/hooks/useGraphStore'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import type { PanelTypography } from 'grph-shared/ui/panelTypography'

export type { PanelTypography } from 'grph-shared/ui/panelTypography'

export function usePanelTypography(): PanelTypography {
  return useGraphStore(
    useShallow(state => {
      const fontClass = state.uiPanelTextFontClass || 'font-sans'
      const textSizeClass = state.uiPanelKeyValueTextSizeClass || 'text-sm'
      const microLabelTextSizeClass =
        state.uiPanelMicroLabelTextSizeClass || state.uiIconBadgeChipTextSizeClass || 'text-[9px]'
      const monospaceTextClass = state.uiPanelMonospaceTextClass || 'font-mono text-xs'
      const keyValueInputClass =
        state.uiPanelKeyValueInputClass || 'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right'
      return {
        fontClass,
        textSizeClass,
        microLabelTextSizeClass,
        monospaceTextClass,
        keyValueInputClass,
        panelTextClass: cn(fontClass, textSizeClass),
        microLabelClass: cn(fontClass, microLabelTextSizeClass),
      }
    }),
  )
}
