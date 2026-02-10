import { useGraphStore } from '@/hooks/useGraphStore'

export const testFlowNodeQuickEditorAnchorOffsetsClearAndSet = () => {
  useGraphStore.setState({ flowNodeQuickEditorAnchorOffsetByNodeId: {} })
  const st = useGraphStore.getState()
  st.setFlowNodeQuickEditorAnchorOffsetByNodeId({ a: { dx: 10, dy: -5 }, b: { dx: 0, dy: 0 } })
  const afterSet = useGraphStore.getState().flowNodeQuickEditorAnchorOffsetByNodeId
  if (!afterSet.a || afterSet.a.dx !== 10 || afterSet.a.dy !== -5) throw new Error('expected offsets to be set for a')
  if (!afterSet.b || afterSet.b.dx !== 0 || afterSet.b.dy !== 0) throw new Error('expected offsets to be set for b')

  useGraphStore.getState().clearFlowNodeQuickEditorAnchorOffsetByNodeId('a')
  const afterClear = useGraphStore.getState().flowNodeQuickEditorAnchorOffsetByNodeId
  if (afterClear.a) throw new Error('expected a offset cleared')
  if (!afterClear.b) throw new Error('expected b offset to remain')

  useGraphStore.setState({ flowNodeQuickEditorAnchorOffsetByNodeId: {} })
}

