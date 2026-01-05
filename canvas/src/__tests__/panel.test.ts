import MainPanel from '@/features/panels/MainPanel'

export function testUnifiedPanelExport() {
  if (typeof MainPanel !== 'function') throw new Error('MainPanel not exported')
}

