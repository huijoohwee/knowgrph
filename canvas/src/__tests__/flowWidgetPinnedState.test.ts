import {
  markFlowWidgetPinPointerActivation,
  readFlowWidgetPinnedInCanvas,
  seedMissingFlowWidgetPinnedByIds,
  setFlowWidgetPinnedById,
  shouldSkipFlowWidgetPinClickAfterPointerActivation,
  toggleFlowWidgetPinnedById,
} from '@/lib/flowEditor/flowWidgetPinnedState'

export function testFlowWidgetPinnedStateHelpersCentralizeDefaultPinnedSemantics() {
  if (readFlowWidgetPinnedInCanvas({}, 'n1') !== true) throw new Error('expected missing pin entries to default to pinned')
  if (readFlowWidgetPinnedInCanvas({ n1: false }, 'n1') !== false) throw new Error('expected explicit false to mean floating')
  if (readFlowWidgetPinnedInCanvas({ n1: true }, 'n1') !== true) throw new Error('expected explicit true to mean pinned')
  if (setFlowWidgetPinnedById({ n1: false }, 'n1', false) !== null) throw new Error('expected no-op pin writes to return null')
  const pinned = setFlowWidgetPinnedById({ n1: false }, 'n1', true)
  if (!pinned || pinned.n1 !== true) throw new Error('expected setFlowWidgetPinnedById to update one pin entry')
  const toggled = toggleFlowWidgetPinnedById({ n1: true }, 'n1')
  if (!toggled || toggled.n1 !== false) throw new Error('expected toggleFlowWidgetPinnedById to invert the effective pin state')
  const seeded = seedMissingFlowWidgetPinnedByIds({ pinnedById: { n1: false }, nodeIds: ['n1', 'n2', '', 'n2'], pinned: true })
  if (!seeded || seeded.n1 !== false || seeded.n2 !== true) throw new Error('expected seedMissingFlowWidgetPinnedByIds to seed only missing ids')
  if (seedMissingFlowWidgetPinnedByIds({ pinnedById: { n1: false }, nodeIds: ['n1'], pinned: true }) !== null) {
    throw new Error('expected seedMissingFlowWidgetPinnedByIds to return null when every id is already present')
  }
  if (!markFlowWidgetPinPointerActivation(' n1 ', 1000)) throw new Error('expected valid pin pointer activation to be recorded')
  if (!shouldSkipFlowWidgetPinClickAfterPointerActivation('n1', 1200)) {
    throw new Error('expected pointer-origin pin clicks to be skipped during the activation guard window')
  }
  if (shouldSkipFlowWidgetPinClickAfterPointerActivation('n1', 1901)) {
    throw new Error('expected stale pointer-origin pin clicks to stop being skipped after the activation guard window')
  }
  if (markFlowWidgetPinPointerActivation('', 1000)) throw new Error('expected empty pin activation ids to be rejected')
}
