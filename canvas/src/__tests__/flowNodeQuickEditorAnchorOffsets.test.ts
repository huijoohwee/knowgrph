import { useGraphStore } from '@/hooks/useGraphStore'

export const testFlowNodeQuickEditorWorldPosSet = () => {
  useGraphStore.setState({ flowNodeQuickEditorWorldPosByNodeId: {} as never })
  const st = useGraphStore.getState()
  st.setFlowNodeQuickEditorWorldPosByNodeId({ a: { x: 10, y: -5 }, b: { x: 0, y: 0 } })
  const afterSet = (useGraphStore.getState() as unknown as { flowNodeQuickEditorWorldPosByNodeId?: Record<string, { x: number; y: number }> })
    .flowNodeQuickEditorWorldPosByNodeId
  if (!afterSet?.a || afterSet.a.x !== 10 || afterSet.a.y !== -5) throw new Error('expected world pos to be set for a')
  if (!afterSet?.b || afterSet.b.x !== 0 || afterSet.b.y !== 0) throw new Error('expected world pos to be set for b')

  useGraphStore.setState({ flowNodeQuickEditorWorldPosByNodeId: {} as never })
}
