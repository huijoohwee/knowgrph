import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'

export function testFlowCollisionPolicyKeepsFlowEditorDragFromRelayoutByDefault() {
  const flowEditorDefault = computeCollisionDuringDrag({ collisionDuringDrag: false, canvas2dRenderer: 'flowEditor' })
  if (flowEditorDefault) {
    throw new Error('expected flowEditor drag to avoid collision-relayout unless explicitly requested')
  }
  const flowEditorExplicit = computeCollisionDuringDrag({ collisionDuringDrag: true, canvas2dRenderer: 'flowEditor' })
  if (flowEditorExplicit) {
    throw new Error('expected flowEditor drag to ignore collisionDuringDrag=true because infinite-canvas drags must not relayout graph elements')
  }

  const respectsExplicit = computeCollisionDuringDrag({ collisionDuringDrag: true, canvas2dRenderer: 'flow' })
  if (!respectsExplicit) {
    throw new Error('expected explicit collisionDuringDrag=true to be preserved')
  }

  const defaultOff = computeCollisionDuringDrag({ collisionDuringDrag: false, canvas2dRenderer: 'flow' })
  if (defaultOff) {
    throw new Error('expected non-flowEditor renderer to keep collisionDuringDrag=false')
  }
}
