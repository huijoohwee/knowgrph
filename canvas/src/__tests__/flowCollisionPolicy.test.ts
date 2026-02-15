import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'

export function testFlowCollisionPolicyForcesCollisionDuringDragInFlowEditor() {
  const enabled = computeCollisionDuringDrag({ collisionDuringDrag: false, canvas2dRenderer: 'flowEditor' })
  if (!enabled) {
    throw new Error('expected flowEditor to force collisionDuringDrag')
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

