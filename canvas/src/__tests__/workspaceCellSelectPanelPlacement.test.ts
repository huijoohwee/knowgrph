import { LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import {
  readWorkspaceCellSelectPanelPlacement,
  writeWorkspaceCellSelectPanelPlacement,
} from '@/features/workspace-table/cellSelectPanelPlacement'

export const testWorkspaceCellSelectPanelPlacementDefaultsAndPersists = () => {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    const d1 = readWorkspaceCellSelectPanelPlacement()
    if (d1 !== 'top') throw new Error('expected default placement to be top')

    const w = writeWorkspaceCellSelectPanelPlacement('bottom')
    if (w !== 'bottom') throw new Error('expected write to normalize placement to bottom')
    const d2 = readWorkspaceCellSelectPanelPlacement()
    if (d2 !== 'bottom') throw new Error('expected read to return persisted bottom placement')

    lsSetJson(LS_KEYS.workspaceCellSelectPanelPlacement, 'nope' as unknown as string)
    const d3 = readWorkspaceCellSelectPanelPlacement()
    if (d3 !== 'top') throw new Error('expected invalid persisted placement to fall back to top')
  } finally {
    restore()
  }
}

