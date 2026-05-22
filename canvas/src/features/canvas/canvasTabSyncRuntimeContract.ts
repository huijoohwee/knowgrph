import type { CanvasTabSyncStoreSnapshot } from '@/features/canvas/canvasTabSyncStoreSelector'
import type { CanvasTabSyncRuntimeRefs } from '@/features/canvas/useCanvasTabSyncRefs'

export type CanvasTabSyncRuntimeProps = CanvasTabSyncStoreSnapshot & CanvasTabSyncRuntimeRefs

export function buildCanvasTabSyncRuntimeProps(
  args: CanvasTabSyncRuntimeProps,
): CanvasTabSyncRuntimeProps {
  return args
}
