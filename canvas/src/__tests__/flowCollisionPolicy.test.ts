import { computeCollisionDuringDrag } from '@/components/FlowCanvas/collisionPolicy'

export function testFlowCollisionPolicyKeepsStoryboardWidgetDragFromRelayoutByDefault() {
  const storyboardWidgetDefault = computeCollisionDuringDrag({ collisionDuringDrag: false, canvas2dRenderer: 'storyboard' })
  if (storyboardWidgetDefault) {
    throw new Error('expected storyboardWidget drag to avoid collision-relayout unless explicitly requested')
  }
  const storyboardWidgetExplicit = computeCollisionDuringDrag({ collisionDuringDrag: true, canvas2dRenderer: 'storyboard' })
  if (storyboardWidgetExplicit) {
    throw new Error('expected storyboardWidget drag to ignore collisionDuringDrag=true because infinite-canvas drags must not relayout graph elements')
  }

  const respectsExplicit = computeCollisionDuringDrag({ collisionDuringDrag: true, canvas2dRenderer: 'flow' })
  if (!respectsExplicit) {
    throw new Error('expected explicit collisionDuringDrag=true to be preserved')
  }

  const defaultOff = computeCollisionDuringDrag({ collisionDuringDrag: false, canvas2dRenderer: 'flow' })
  if (defaultOff) {
    throw new Error('expected non-storyboard renderer to keep collisionDuringDrag=false')
  }
}
