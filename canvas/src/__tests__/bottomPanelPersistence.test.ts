import { LS_KEYS } from '@/lib/config'
import { openBottomPanel } from '@/features/bottom-panel/open'
import { DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { useGraphStore } from '@/hooks/useGraphStore'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { initWindowHarness } from '@/tests/lib/windowHarness'

export function testBottomPanelCollapsePersistence() {
  if (LS_KEYS.bottomPanelCollapsed !== 'kg:ui:bottomPanel:collapsed') {
    throw new Error('bottomPanelCollapsed key mismatch')
  }
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })

  const state = useGraphStore.getState()
  state.setBottomPanelHeightRatio(0)
  state.setBottomPanelTab('stats')

  storage.setItem(LS_KEYS.bottomPanelCollapsed, '1')

  openBottomPanel('schema')

  const stored = storage.getItem(LS_KEYS.bottomPanelCollapsed)
  if (stored !== '0') {
    throw new Error('bottom panel collapse flag not cleared on open')
  }
  const after = useGraphStore.getState()
  if (after.bottomPanelTab !== 'schema') {
    throw new Error('bottom panel tab not updated')
  }
  if (after.bottomPanelHeightRatio < DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO) {
    throw new Error('bottom panel height ratio not restored to default')
  }

  restore()
}

