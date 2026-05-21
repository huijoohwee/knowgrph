import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSourceFilesSwitchingStaysPassiveAndFlowLayoutIgnoresInteractionPositions() {
  const ingestText = readFileSync(resolve(process.cwd(), 'src/features/source-files/sourceFilesIngestIntegration.ts'), 'utf8')
  const loaderText = readFileSync(resolve(process.cwd(), 'src/features/markdown-workspace/useMarkdownLoader.ts'), 'utf8')
  const flowPositionsText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/useFlowComputedPositions.ts'), 'utf8')
  const topologyText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/flowLayoutTopologyKey.ts'), 'utf8')

  if (!ingestText.includes('autoEnableFrontmatter: false') || !ingestText.includes('applyViewPreset: opts?.applyToGraph === true')) {
    throw new Error('expected Source Files activation to keep passive file switches from applying YAML/frontmatter canvas presets')
  }
  if (ingestText.includes('forceApplyToGraph: true')) {
    throw new Error('expected Source Files activation to stop forcing graph apply during passive file switching')
  }
  if (!loaderText.includes('autoEnableFrontmatter: false') || !loaderText.includes('applyViewPreset: false')) {
    throw new Error('expected markdown workspace file loading/edit sync to keep Source Files switches passive')
  }
  if (!topologyText.includes("buildScopedGraphSemanticKey('flow-layout-topology'")) {
    throw new Error('expected Flow layout topology identity to reuse the shared semantic-key helper')
  }
  if (flowPositionsText.includes('sourceSeedHash') || topologyText.includes('sourceSeedHash')) {
    throw new Error('expected Flow layout computation identity to ignore x/y seed churn from drag, pan, and zoom interactions')
  }
}
