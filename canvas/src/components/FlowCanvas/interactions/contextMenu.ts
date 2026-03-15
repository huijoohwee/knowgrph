import { shouldSuppressContextMenuForPreset } from '@/lib/canvas/viewport-controls'

import type { FlowNativeInteractionsContext } from '@/components/FlowCanvas/interactions/context'

export function createFlowNativeContextMenuHandler(ctx: FlowNativeInteractionsContext) {
  return (e: MouseEvent) => {
    const preset = ctx.getPreset()
    if (!shouldSuppressContextMenuForPreset(preset)) return
    try {
      e.preventDefault()
    } catch {
      void 0
    }
  }
}
