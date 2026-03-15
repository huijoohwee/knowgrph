import type { GraphSchema } from '@/lib/graph/schema'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'

import type { FlowNativeRuntime } from '@/components/FlowCanvas/nativeRuntime'
import type { BindFlowCanvasNativeInteractionsArgs, FlowCanvasDrag } from '@/components/FlowCanvas/interactions/types'

export type FlowEffectiveSelectMode = 'single' | 'multi' | 'lasso'

export type FlowNativeInteractionsContext = {
  args: BindFlowCanvasNativeInteractionsArgs
  canvasEl: HTMLCanvasElement
  runtime: FlowNativeRuntime
  touchPointsById: Map<number, { sx: number; sy: number }>
  edgeScroll: { update: (input: any) => { dx: number; dy: number }; reset: () => void }
  getPreset: () => ViewportControlsPreset
  readEffectiveSelectMode: (st: any, isFlowEditor: boolean) => FlowEffectiveSelectMode
  computeScaleExtent: (args: { schema: GraphSchema; currentK: number }) => { minK: number; maxK: number }
  viewportWheelController: { handleWheel: (e: WheelEvent) => boolean; destroy: () => void }
  cancelActiveDragIfStale: (drag: NonNullable<FlowCanvasDrag>) => boolean
  scheduleDragRelax: () => void
}
