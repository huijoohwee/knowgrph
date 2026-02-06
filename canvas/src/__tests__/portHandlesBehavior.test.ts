import { defaultSchema } from '@/lib/graph/schema'
import { isPortHandlesShowAllInputsEnabled, togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'

export const testTogglePortHandlesPreservesShowAllInputsFlag = () => {
  const base = {
    ...defaultSchema,
    behavior: {
      ...defaultSchema.behavior,
      portHandles: { enabled: false, showAllInputs: true },
    },
  }

  const first = togglePortHandlesEnabledInSchema(base)
  if (!first.changed) throw new Error('expected toggle to report changed=true')
  if (first.schema === base) throw new Error('expected toggle to return a new schema reference')
  if (first.schema.behavior?.portHandles?.enabled !== true) throw new Error('expected enabled=true after first toggle')
  if (first.schema.behavior?.portHandles?.showAllInputs !== true) throw new Error('expected showAllInputs to be preserved')
  if (!isPortHandlesShowAllInputsEnabled(first.schema)) throw new Error('expected showAllInputs to be active when enabled=true')

  const second = togglePortHandlesEnabledInSchema(first.schema)
  if (second.schema.behavior?.portHandles?.enabled !== false) throw new Error('expected enabled=false after second toggle')
  if (second.schema.behavior?.portHandles?.showAllInputs !== true) throw new Error('expected showAllInputs to remain preserved')
  if (isPortHandlesShowAllInputsEnabled(second.schema)) {
    throw new Error('expected showAllInputs to be inactive when enabled=false')
  }
}

