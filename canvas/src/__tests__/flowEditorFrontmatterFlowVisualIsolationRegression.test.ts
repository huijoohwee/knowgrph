import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (...parts: string[]) => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8')

export function testFlowEditorOverlayOnlyUsesUpstreamVisualIsolation() {
  const text = read('components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const visibilityText = read('components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceVisibility.ts')
  const sharedText = read('components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  if (!text.includes('frontmatterOverlayVisualIsolation')) {
    throw new Error('expected FlowEditor overlay mode to compute frontmatter visibility safety state')
  }
  if (!text.includes('resolveFrontmatterOverlayVisualIsolationWithStableCoverage')) {
    throw new Error('expected FlowEditor overlay surface to resolve frontmatter visual isolation through the shared coverage helper')
  }
  if (!text.includes('listDisplayRichMediaOverlayNodes')) {
    throw new Error('expected FlowEditor overlay safety to include rich media overlay coverage in frontmatter-flow mode')
  }
  if (
    !visibilityText.includes('const overlayCoverageIdSet = buildCanonicalNodeIdSet([')
    || !visibilityText.includes('...overlayEditorNodeIdsSnapshot')
    || !visibilityText.includes('...frontmatterRichMediaOverlayNodeIdsSnapshot')
  ) {
    throw new Error('expected FlowEditor overlay safety to combine widget and rich media overlay coverage with the shared canonical id helper before deriving Flow Editor-owned visual nodes')
  }
  if (!visibilityText.includes('isFrontmatterFlowGraph(renderGraphDataOverride)')) {
    throw new Error('expected FlowEditor overlay safety to use shared frontmatter-flow graph identity for composed graph visual isolation')
  }
  if (
    !text.includes('deriveSceneDisplayGraph({ graphData: args.renderGraphDataOverride })')
    && !text.includes('deriveSceneDisplayGraph({ graphData: renderGraphDataOverride })')
  ) {
    throw new Error('expected frontmatter overlay safety to derive visible flow coverage from the shared scene display graph')
  }
  if (!visibilityText.includes('const visibleFlowNodeIds = visibleNodeIds.filter')) {
    throw new Error('expected frontmatter overlay safety to limit coverage checks to visible flow-widget nodes')
  }
  if ((text + visibilityText).includes('const frontmatterExcludedNodeIds = normalizeStringArrayForSignature([')) {
    throw new Error('expected frontmatter FlowCanvas graph exclusion to avoid folding rich-media overlay source nodes into the widget-only graph filter')
  }
  if (
    !visibilityText.includes('const frontmatterFlowOwnedNodeIds =')
    || !visibilityText.includes('excludedNodeIds: frontmatterFlowOwnedNodeIds')
    || !visibilityText.includes('listFrontmatterFlowOwnedRenderNodeIds(renderGraphDataOverride)')
  ) {
    throw new Error('expected frontmatter FlowCanvas graph exclusion to partition all Flow Editor-owned render nodes upstream before FlowCanvas rendering')
  }
  if (!sharedText.includes('normalizeGraphFilterNodeIdSet')) {
    throw new Error('expected shared FlowCanvas graph filtering to normalize canonical overlay ids before exclusion')
  }
  if (!sharedText.includes('resolveGraphNodeIdByCanonicalId(graphData, id)')) {
    throw new Error('expected shared FlowCanvas graph filtering to resolve canonical overlay ids to concrete graph ids before exclusion')
  }
  if (!visibilityText.includes("if (frontmatterOverlayVisualIsolation.kind === 'frontmatter-flow') {")) {
    throw new Error('expected frontmatter-flow overlay guard to branch explicitly before overlay-only canvas runtime policy')
  }
  if (!visibilityText.includes('FlowCanvas') || !visibilityText.includes('partitioned before FlowCanvas')) {
    throw new Error('expected frontmatter-flow overlay guard to document upstream graph partitioning before FlowCanvas receives renderer primitives')
  }
  if (!visibilityText.includes("if (frontmatterOverlayVisualIsolation.kind === 'frontmatter-flow') {\n    // Frontmatter-flow Flow Editor scenes are partitioned before FlowCanvas")) {
    throw new Error('expected frontmatter-flow overlay guard to force graph partitioning before workspace/view fallback gating')
  }
  if (!visibilityText.includes('return true')) {
    throw new Error('expected frontmatter-flow overlay guard to keep Flow Editor visual authority while overlays hydrate')
  }
}
