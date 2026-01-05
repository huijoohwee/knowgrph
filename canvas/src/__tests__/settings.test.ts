import { settingsRegistry } from '@/features/settings/registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from '@/features/settings/types'

export const testSettingsRegistryReadWrite = () => {
  const panel = settingsRegistry.find(x => x.key === 'uiPanelOpacity')!
  const toolbar = settingsRegistry.find(x => x.key === 'uiToolbarOpacity')!
  const write = (meta: SettingMeta, val: number) => { if (meta.write) meta.write(val) }
  write(panel, 10)
  if (useGraphStore.getState().uiPanelOpacity !== 1) throw new Error('panel clamp failed')
  write(toolbar, 0.5)
  if (useGraphStore.getState().uiToolbarOpacity !== 0.5) throw new Error('toolbar write failed')
}


// flow schema is served at runtime; covered by manual verification
