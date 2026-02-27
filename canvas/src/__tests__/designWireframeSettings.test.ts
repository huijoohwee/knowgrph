import { readDesignWireframeSettings } from '@/lib/render/designWireframeSettings'

export function testDesignWireframeSettingsDefaultsAndClamp() {
  const base = readDesignWireframeSettings(null)
  if (typeof base.showEdges !== 'boolean') throw new Error('expected boolean default showEdges')
  if (typeof base.maxEdges !== 'number' || base.maxEdges <= 0) throw new Error('expected numeric default maxEdges')

  const bad = readDesignWireframeSettings({
    metadata: {
      'renderer:designWireframe': {
        showEdges: 'yes',
        showLabelChips: 1,
        showMetaChips: null,
        avoidLabelCollisions: 'no',
        showTextPreview: {},
        showMediaPreview: [],
        depthFade: 'true',
        maxEdges: 999999,
        maxLabelChars: -5,
      },
    },
  } as unknown as never)
  if (bad.maxEdges !== 5000) throw new Error('expected maxEdges to clamp to 5000')
  if (bad.maxLabelChars !== 8) throw new Error('expected maxLabelChars to clamp to 8')

  const ok = readDesignWireframeSettings({
    metadata: {
      'renderer:designWireframe': {
        showEdges: true,
        showLabelChips: false,
        showMetaChips: true,
        avoidLabelCollisions: false,
        showTextPreview: false,
        showMediaPreview: true,
        depthFade: false,
        maxEdges: 120,
        maxLabelChars: 32,
      },
    },
  } as unknown as never)
  if (ok.showEdges !== true) throw new Error('expected showEdges true')
  if (ok.showLabelChips !== false) throw new Error('expected showLabelChips false')
  if (ok.avoidLabelCollisions !== false) throw new Error('expected avoidLabelCollisions false')
  if (ok.maxEdges !== 120) throw new Error('expected maxEdges 120')
  if (ok.maxLabelChars !== 32) throw new Error('expected maxLabelChars 32')
}
