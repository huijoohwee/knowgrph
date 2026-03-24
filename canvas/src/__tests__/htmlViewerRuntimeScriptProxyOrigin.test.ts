import { buildHtmlViewerRuntimeScript } from '@/lib/graph/htmlViewer/runtimeScript'

export function testHtmlViewerRuntimeScriptReplacesProxyOriginPlaceholder() {
  const out = buildHtmlViewerRuntimeScript({
    interactionCfgJson: '{}',
    mediaNodesJson: '[]',
    markdownBlocksJson: '[]',
    nodeLabelByIdJson: '{}',
    edgeMetaByIdJson: '{}',
    frontmatterVisibilityJson: '{"nodeIds":[],"edgeIds":[]}',
    nodePosByIdJson: '{}',
    groupMembersByIdJson: '{}',
    density: 'default',
    widthRatioDefault: 0.22,
    widthRatioCompact: 0.14,
    widthMinDefault: 220,
    widthMinCompact: 180,
    widthMaxDefault: 460,
    widthMaxCompact: 360,
    proxyOrigin: 'http://localhost:5173',
  })

  if (out.includes('__KG_PROXY_ORIGIN__')) {
    throw new Error('Expected __KG_PROXY_ORIGIN__ placeholder to be replaced')
  }
  if (out.includes('__KG_MD_BLOCKS__')) {
    throw new Error('Expected markdown blocks to be embedded, not a placeholder token')
  }
  if (!out.includes('http://localhost:5173')) {
    throw new Error('Expected proxy origin string to be embedded into runtime script')
  }
  if (!out.includes("root ? Array.prototype.slice.call(root.querySelectorAll('[data-node-id]'))")) {
    throw new Error('Expected frontmatter visibility to include non-SVG node elements')
  }

  if (!out.includes('installMarkdownBlockInteractions')) {
    throw new Error('Expected markdown design block interaction installer to be embedded')
  }

  if (!out.includes('iframe.srcdoc')) {
    throw new Error('Expected iframe srcdoc support in runtime script')
  }

  if (!out.includes('svg.__kgNodeOffsetById')) {
    throw new Error('Expected edge geometry to incorporate overlay follow offsets for parity')
  }

  if (!out.includes('scheduleEdgeGeometryUpdateForNode(nodeId)')) {
    throw new Error('Expected node offset translation to schedule edge geometry updates')
  }
}
