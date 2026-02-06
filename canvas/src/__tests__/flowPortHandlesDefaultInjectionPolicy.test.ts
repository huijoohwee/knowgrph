import { defaultSchema } from '@/lib/graph/schema'
import { shouldInjectDefaultFlowHandles } from '@/lib/graph/portHandlesBehavior'

export const testFlowPortHandlesEnabledInjectsDefaultsWhenShowAllInputsMissing = () => {
  const base = {
    ...defaultSchema,
    behavior: { ...defaultSchema.behavior, portHandles: { ...defaultSchema.behavior.portHandles, enabled: true } },
  }

  if (!shouldInjectDefaultFlowHandles(base)) throw new Error('expected defaults injection when enabled and showAllInputs missing')
}

export const testFlowPortHandlesEnabledRespectsExplicitShowAllInputsFalse = () => {
  const base = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      portHandles: { ...defaultSchema.behavior.portHandles, enabled: true, showAllInputs: false },
    },
  }

  if (shouldInjectDefaultFlowHandles(base)) throw new Error('expected defaults injection to be disabled when showAllInputs=false')
}

