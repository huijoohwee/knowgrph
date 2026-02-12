import { settingsRegistry } from '@/features/settings/registry'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from '@/features/settings/types'

export const testSettingsRegistryReadWrite = () => {
  const panel = settingsRegistry.find(x => x.key === 'uiPanelOpacity')!
  const toolbar = settingsRegistry.find(x => x.key === 'uiToolbarOpacity')!
  const webpageView = settingsRegistry.find(x => x.key === 'webpageImportView')!
  const webpageIframeMode = settingsRegistry.find(x => x.key === 'webpageHtmlIframeMode')!
  const write = (meta: SettingMeta, val: string | number | boolean) => { if (meta.write) meta.write(val) }
  write(panel, 10)
  if (useGraphStore.getState().uiPanelOpacity !== 1) throw new Error('panel clamp failed')
  write(toolbar, 0.5)
  if (useGraphStore.getState().uiToolbarOpacity !== 0.5) throw new Error('toolbar write failed')
  write(webpageView, 'html')
  if (useGraphStore.getState().webpageImportView !== 'html') throw new Error('webpage view write failed')
  if (webpageView.read && webpageView.read() !== 'html') throw new Error('webpage view read failed')

  write(webpageIframeMode, 'src')
  if (useGraphStore.getState().webpageHtmlIframeMode !== 'src') throw new Error('webpage iframe mode write failed')
  if (webpageIframeMode.read && webpageIframeMode.read() !== 'src') throw new Error('webpage iframe mode read failed')
}


// flow schema is served at runtime; covered by manual verification
