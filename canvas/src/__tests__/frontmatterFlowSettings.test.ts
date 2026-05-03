import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

export const testFrontmatterFlowSettingsReuseSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'frontmatterFlowSettings.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected frontmatter flow settings to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('return isPlainObject(rawSettings) ? settings : null')) {
    throw new Error('expected frontmatter flow settings record reads to reuse the shared plain-object guard')
  }
  if (text.includes("return rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? settings : null")) {
    throw new Error('expected frontmatter flow settings to stop coercing settings objects inline')
  }
}
