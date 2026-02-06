import { computeFlowCommitRelaxSteps, computeFlowDragRelaxPolicy } from '@/components/FlowCanvas/relaxStepPolicy'

export async function testFlowRelaxStepPolicyBoundedAndMonotonic() {
  const dragSmall = computeFlowDragRelaxPolicy({ nodeCount: 50, groupCount: 0 })
  if (!dragSmall.enabled) throw new Error('expected drag relax enabled for small graphs')
  if (dragSmall.steps < 2) throw new Error('expected drag relax to use multiple steps for small graphs')
  if (dragSmall.minIntervalMs > 16) throw new Error('expected small-graph drag relax to allow 60fps cadence')

  const dragLarge = computeFlowDragRelaxPolicy({ nodeCount: 2000, groupCount: 1 })
  if (dragLarge.enabled) throw new Error('expected drag relax disabled for very large graphs')

  const commitSmall = computeFlowCommitRelaxSteps({ nodeCount: 100, groupCount: 0 })
  const commitMedium = computeFlowCommitRelaxSteps({ nodeCount: 700, groupCount: 0 })
  const commitLarge = computeFlowCommitRelaxSteps({ nodeCount: 2000, groupCount: 0 })
  if (!(commitSmall >= commitMedium && commitMedium >= commitLarge)) {
    throw new Error('expected commit relax steps to decrease as graphs grow')
  }
  if (commitLarge > 6) throw new Error('expected large-graph commit relax steps to stay bounded')
}

