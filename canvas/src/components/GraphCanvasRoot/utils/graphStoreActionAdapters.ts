import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { dispatchRuntimeZoomActionSoon } from '@/lib/canvas/runtimeZoomDispatch'

type SelectionSource = 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown'

export function buildGraphCanvasStoreActionAdapters(args: {
  setHoverInfo: Dispatch<SetStateAction<HoverInfo | null>>
  workspaceOverlayOpenRef?: MutableRefObject<boolean>
  enableNodePositionCommit?: boolean
}) {
  const readStore = () => useGraphStore.getState()

  const runWritable = <TArgs extends unknown[]>(
    action: (store: ReturnType<typeof readStore>, ...params: TArgs) => void,
  ) => {
    return (...params: TArgs) => {
      if (args.workspaceOverlayOpenRef?.current) return
      action(readStore(), ...params)
    }
  }

  return {
    setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => args.setHoverInfo(prev => updater(prev)),
    selectNode: (id: string | null) => readStore().selectNode(id),
    selectEdge: (id: string | null) => readStore().selectEdge(id),
    selectGroup: (id: string | null) => readStore().selectGroup(id),
    selectGroupExpanded: (group: { id: string; nodeIds: string[]; edgeIds: string[] }) =>
      readStore().selectGroupExpanded({ id: group.id, nodeIds: group.nodeIds, edgeIds: group.edgeIds }),
    toggleGroupCollapsed: (id: string) => readStore().toggleGroupCollapsed(id),
    setSelectionSource: (source: SelectionSource) => readStore().setSelectionSource(source),
    addNode: runWritable((store, node: GraphNode) => store.addNode(node)),
    updateNode: runWritable((store, id: string, update: Partial<GraphNode>) => store.updateNode(id, update)),
    addEdge: runWritable((store, edge: GraphEdge) => store.addEdge(edge)),
    updateEdge: runWritable((store, id: string, update: Partial<GraphEdge>) => store.updateEdge(id, update)),
    setLifecycleStageRendering: () => readStore().setLifecycleStage('rendering'),
    requestZoomSelection: () => dispatchRuntimeZoomActionSoon('selection'),
    edgeScrollEnabled: () => readStore().viewPinned !== true,
    onCommitNodePosition: args.enableNodePositionCommit
      ? ({ id, x, y }: { id: string; x: number; y: number }) => {
          readStore().updateNode(id, { x, y })
        }
      : undefined,
  }
}
