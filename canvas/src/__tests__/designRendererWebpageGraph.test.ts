import { createDesignRendererSlice } from '@/hooks/store/designRendererSlice'

import type { GraphState } from '@/hooks/store/types'
import type { GraphNode } from '@/lib/graph/types'

export function testDesignRendererWebpageGraphSetterNoopsOnSameKey() {
  let state: Partial<GraphState> = {
    designRendererWebpageLayoutKey: null,
    designRendererGraphNodesById: {},
    designRendererNodes: [],
  }
  const setCalls: Array<Record<string, unknown>> = []
  const set = (patch: Partial<GraphState>) => {
    setCalls.push(patch as unknown as Record<string, unknown>)
    state = { ...state, ...patch }
  }
  const get = () => state as GraphState

  const slice = createDesignRendererSlice(set as never, get as never) as unknown as {
    setDesignRendererWebpageGraph: (args: { key: string | null; nodesById: Record<string, GraphNode> }) => void
  }

  slice.setDesignRendererWebpageGraph({ key: 'u#1#2', nodesById: { a: { id: 'a', label: 'a', type: 'x', properties: {}, x: 0, y: 0 } as GraphNode } })
  if (setCalls.length !== 1) throw new Error('expected first set')

  slice.setDesignRendererWebpageGraph({ key: 'u#1#2', nodesById: { b: { id: 'b', label: 'b', type: 'x', properties: {}, x: 0, y: 0 } as GraphNode } })
  if (setCalls.length !== 1) throw new Error('expected no set when key unchanged')

  slice.setDesignRendererWebpageGraph({ key: null, nodesById: {} })
  if (setCalls.length < 2) throw new Error('expected set on key clear')
}
