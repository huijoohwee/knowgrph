import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSourceFilesSwitchingAppliesFileContentAndFlowLayoutIgnoresInteractionPositions() {
  const ingestText = readFileSync(resolve(process.cwd(), 'src/features/source-files/sourceFilesIngestIntegration.ts'), 'utf8')
  const loaderText = readFileSync(resolve(process.cwd(), 'src/features/markdown-workspace/useMarkdownLoader.ts'), 'utf8')
  const selectionText = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/useMarkdownWorkspaceSelection.ts'), 'utf8')
  const viewShellText = readFileSync(resolve(process.cwd(), 'src/lib/markdown-workspace-runtime/useMarkdownWorkspaceViewShell.tsx'), 'utf8')
  const flowPositionsText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/useFlowComputedPositions.ts'), 'utf8')
  const topologyText = readFileSync(resolve(process.cwd(), 'src/components/FlowCanvas/flowLayoutTopologyKey.ts'), 'utf8')

  if (!ingestText.includes('autoEnableFrontmatter: false') || !ingestText.includes('applyViewPreset: opts?.applyToGraph === true')) {
    throw new Error('expected Source Files import activation to apply YAML/frontmatter presets only when graph apply is explicit')
  }
  if (ingestText.includes('forceApplyToGraph: true')) {
    throw new Error('expected Source Files import activation to avoid unconditional graph apply')
  }
  if (!loaderText.includes('autoEnableFrontmatter: false') || !loaderText.includes('applyViewPreset: false')) {
    throw new Error('expected markdown workspace editor text sync to avoid replaying YAML/frontmatter presets on every edit')
  }
  if (!selectionText.includes('autoEnableFrontmatter: true') || !selectionText.includes('applyViewPreset: true') || !selectionText.includes('applyToGraph: true')) {
    throw new Error('expected Source Files selection to render selected file content and apply YAML/frontmatter canvas presets')
  }
  if (!selectionText.includes('if (nextPath && prevPath && prevPath !== nextPath) {') || !selectionText.includes('if (switched.next !== args.activePath) return')) {
    throw new Error('expected Source Files switching to preserve the pending switch until the matching active-document apply consumes it')
  }
  if (!selectionText.includes('readWorkspaceActiveDocumentResolvedText({') || !selectionText.includes('args.patchWorkspaceEntryInlineText(nextPath, nextText)')) {
    throw new Error('expected Source Files switching to hydrate metadata-only workspace entries through the shared active-document resolver before Canvas apply')
  }
  if (viewShellText.includes("React.startTransition(() => {\n        setSelectionSource('editor')")) {
    throw new Error('expected Source Files row selection to update the active file synchronously under renderer load')
  }
  if (!topologyText.includes("buildScopedGraphSemanticKey('flow-layout-topology'")) {
    throw new Error('expected Flow layout topology identity to reuse the shared semantic-key helper')
  }
  if (flowPositionsText.includes('sourceSeedHash') || topologyText.includes('sourceSeedHash')) {
    throw new Error('expected Flow layout computation identity to ignore x/y seed churn from drag, pan, and zoom interactions')
  }
}
