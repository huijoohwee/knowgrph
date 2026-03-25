import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'

export function testZoomCommitDoesNotWriteWhenOnlyGraphDataRevisionChanges() {
  let zoomState: any = null
  const zoomStateByKey: Record<string, any> = {}
  let globalWrites = 0
  let keyedWrites = 0

  const run = (graphDataRevision: number) =>
    commitZoomTransformToStore({
      state: {
        viewPinned: false,
        zoomState,
        zoomStateByKey,
        setZoomState: z => {
          globalWrites += 1
          zoomState = z
        },
        setZoomStateForKey: (key, z) => {
          keyedWrites += 1
          zoomStateByKey[key] = z
        },
      },
      zoomViewKey: 'd3:test',
      transform: { k: 1, x: 0, y: 0 },
      viewportW: 1000,
      viewportH: 800,
      graphDataRevision,
    })

  const first = run(1)
  if (!first) throw new Error('expected first zoom commit to write')
  if (globalWrites !== 1 || keyedWrites !== 1) throw new Error('expected first zoom commit to write global and keyed state')

  const second = run(2)
  if (second) throw new Error('expected zoom commit to no-op when only graphDataRevision changes')
  if (globalWrites !== 1 || keyedWrites !== 1) throw new Error('expected no additional zoom state writes when transform is unchanged')
}

