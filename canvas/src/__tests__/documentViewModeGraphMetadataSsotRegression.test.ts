import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDocumentViewModeGraphMetadataHelpersStayUpstream() {
  const documentViewModeText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'graph', 'documentViewMode.ts'),
    'utf8',
  )
  const frontmatterModeText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'graph', 'frontmatterMode.ts'),
    'utf8',
  )
  const displayFilterText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'displayFilter.ts'),
    'utf8',
  )
  const activeViewGraphText = readFileSync(
    resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'activeViewGraph.ts'),
    'utf8',
  )
  const activeGraphRenderDataText = readFileSync(
    resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'useActiveGraphRenderData.impl.ts'),
    'utf8',
  )

  if (!documentViewModeText.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected documentViewMode to reuse the shared document metadata coercion helper upstream')
  }
  if (!documentViewModeText.includes('const readDocumentViewModeMetadata =')) {
    throw new Error('expected documentViewMode to keep one upstream graph metadata reader for document view mode helpers')
  }
  if (!frontmatterModeText.includes('export function readFlowchartFrontmatterGraphSource')) {
    throw new Error('expected frontmatterMode to centralize flowchart frontmatter graph source selection upstream')
  }
  if (!frontmatterModeText.includes("import { toMetadataRecord } from '@/lib/graph/documentMetadata'")) {
    throw new Error('expected frontmatterMode to reuse the shared document metadata coercion helper upstream')
  }
  if (!frontmatterModeText.includes('const readNormalizedDocumentSemanticMode =')) {
    throw new Error('expected frontmatterMode to centralize document semantic mode normalization upstream')
  }
  if (!frontmatterModeText.includes('const readFrontmatterGraphMetadata =')) {
    throw new Error('expected frontmatterMode to centralize frontmatter graph metadata coercion upstream')
  }
  if (!frontmatterModeText.includes('const semantic = readNormalizedDocumentSemanticMode(args.documentSemanticMode)')) {
    throw new Error('expected frontmatterMode semantic request helpers to reuse the shared normalization helper')
  }
  if (!frontmatterModeText.includes('const metadata = readFrontmatterGraphMetadata(graphData)')) {
    throw new Error('expected frontmatterMode frontmatter-flow detection to reuse the shared metadata coercion helper')
  }
  if (!frontmatterModeText.includes('): Record<string, unknown> => toMetadataRecord(graphData?.metadata)')) {
    throw new Error('expected frontmatterMode metadata reader to delegate to the shared document metadata helper')
  }
  if (!documentViewModeText.includes('const meta = readDocumentViewModeMetadata(graphData)')) {
    throw new Error('expected documentViewMode graph metadata readers to reuse the shared metadata coercion helper')
  }
  if (!documentViewModeText.includes('): Record<string, unknown> => toMetadataRecord(graphData?.metadata)')) {
    throw new Error('expected documentViewMode metadata reader to delegate to the shared document metadata helper')
  }
  if (!documentViewModeText.includes('const meta = readDocumentViewModeMetadata(graphData)')) {
    throw new Error('expected documentViewMode graph metadata writers to reuse the shared metadata coercion helper')
  }
  if (documentViewModeText.includes('const meta = readDocumentViewModeMetadata(graphData) || {}')) {
    throw new Error('expected documentViewMode graph metadata writers to stop layering local fallback records on top of the shared helper')
  }
  if (!documentViewModeText.includes('metadata: {')) {
    throw new Error('expected documentViewMode graph metadata writers to reuse the shared metadata coercion helper')
  }

  if (!displayFilterText.includes('readGraphActiveDocumentViewMode(graphData)')) {
    throw new Error('expected displayFilter to reuse the shared graph active document view mode reader')
  }
  if (displayFilterText.includes("['kg:activeDocumentViewMode']")) {
    throw new Error('expected displayFilter to avoid reading active document view mode metadata inline')
  }

  if (!activeViewGraphText.includes('withActiveDocumentViewMode(')) {
    throw new Error('expected activeViewGraph to reuse the shared graph active document view mode writer')
  }
  if (!activeViewGraphText.includes('export function deriveFrontmatterActiveViewGraph')) {
    throw new Error('expected activeViewGraph to centralize shared frontmatter active-view derivation upstream')
  }
  if (!activeViewGraphText.includes('export function deriveFlowchartFrontmatterActiveViewGraph')) {
    throw new Error('expected activeViewGraph to centralize flowchart-specific frontmatter active-view gating upstream')
  }
  if (!activeViewGraphText.includes('readFlowchartFrontmatterGraphSource(args)')) {
    throw new Error('expected activeViewGraph to reuse the shared frontmatter flowchart source helper')
  }
  if (activeViewGraphText.includes("['kg:activeDocumentViewMode']")) {
    throw new Error('expected activeViewGraph to avoid writing active document view mode metadata inline')
  }

  if (!activeGraphRenderDataText.includes('deriveFlowchartFrontmatterActiveViewGraph({')) {
    throw new Error('expected active graph render data to reuse the shared flowchart frontmatter active-view helper')
  }
  if (activeGraphRenderDataText.includes('containsFrontmatterMermaid(')) {
    throw new Error('expected active graph render data to avoid re-implementing markdown frontmatter mermaid gating inline')
  }
  if (activeGraphRenderDataText.includes('hasFrontmatterMermaidSeeds(')) {
    throw new Error('expected active graph render data to avoid re-implementing graph seed gating inline')
  }
  if (activeGraphRenderDataText.includes('isFrontmatterFlowGraph(graphData)')) {
    throw new Error('expected active graph render data to avoid re-implementing frontmatter flow passthrough gating inline')
  }
  if (activeGraphRenderDataText.includes("['kg:activeDocumentViewMode']")) {
    throw new Error('expected active graph render data to avoid writing active document view mode metadata inline')
  }
}
