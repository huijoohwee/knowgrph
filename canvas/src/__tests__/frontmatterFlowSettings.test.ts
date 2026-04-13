import { isFrontmatterFlowComputedEnabled, readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'

export const testFrontmatterFlowRenderSettingsReadsDirectionAndEdgeType = () => {
  const settings = readFrontmatterFlowRenderSettings({
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterFlowSettings: {
        direction: 'BT',
        edgeType: 'smoothstep',
      },
    },
  } as never)
  if (!settings) throw new Error('expected frontmatter flow render settings')
  if (settings.rankdir !== 'TB') throw new Error(`expected BT to normalize to TB, got ${settings.rankdir}`)
  if (settings.edgeType !== 'smoothstep') throw new Error(`expected smoothstep edge type, got ${settings.edgeType}`)
}

export const testFrontmatterFlowRenderSettingsFallsBackOutsideFrontmatterFlow = () => {
  const settings = readFrontmatterFlowRenderSettings({
    metadata: {
      kind: 'markdown',
      frontmatterFlowSettings: {
        direction: 'LR',
        edgeType: 'step',
      },
    },
  } as never)
  if (settings !== null) throw new Error('expected non-frontmatter graph to ignore frontmatter flow settings')
}

export const testFrontmatterFlowComputedEnabledDefaultsTrueAndHonorsFalse = () => {
  const enabledDefault = isFrontmatterFlowComputedEnabled({
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterFlowSettings: {},
    },
  } as never)
  if (enabledDefault !== true) throw new Error('expected frontmatter flow computed to default to true')

  const disabled = isFrontmatterFlowComputedEnabled({
    metadata: {
      kind: 'frontmatter-flow',
      frontmatterFlowSettings: {
        computed: false,
      },
    },
  } as never)
  if (disabled !== false) throw new Error('expected frontmatter flow computed=false to disable runtime compute')
}
