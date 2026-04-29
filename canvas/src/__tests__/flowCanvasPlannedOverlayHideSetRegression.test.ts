import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasHidesPlannedOverlayNodesNotJustMountedElements() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('const [plannedOverlayNodeIds, setPlannedOverlayNodeIds] = React.useState<string[]>([])')) {
    throw new Error('expected FlowCanvas to track planned overlay node ids in state')
  }
  if (!text.includes('const handlePlannedOverlayNodeIdsChange = React.useCallback((ids: string[]) => {')) {
    throw new Error('expected FlowCanvas to route planned overlay updates through a stable callback')
  }
  if (!text.includes('if (plannedOverlayNodeIdsKeyRef.current === nextKey) return')) {
    throw new Error('expected FlowCanvas planned overlay updates to ignore unchanged id signatures')
  }
  if (!text.includes('const overlayIds = plannedOverlayNodeIds.filter(Boolean)')) {
    throw new Error('expected FlowCanvas hide lists to continue using planned overlay ids')
  }
}
