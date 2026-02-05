import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'

export const testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation = () => {
  // Mock Graph Data mimicking abc123.md structure
  // H1: "ABC" (Section)
  // H2: "1-2-3..." (Section) -> child of H1
  // Content 1: "Blockquote" -> child of H1
  // Content 2: "Image" -> child of H2
  
  const nodes: GraphNode[] = [
    { id: 'h1', label: 'ABC', type: 'Section', properties: { level: 1 }, x: 0, y: 0 },
    { id: 'h2', label: '1-2-3', type: 'Section', properties: { level: 2 }, x: 0, y: 100 },
    { id: 'c1', label: 'Blockquote', type: 'Block', properties: {}, x: 10, y: 10 },
    { id: 'c2', label: 'Image', type: 'Block', properties: {}, x: 10, y: 110 },
  ]
  
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'h1', target: 'h2', label: 'hasSection', properties: {} },
    { id: 'e2', source: 'h1', target: 'c1', label: 'hasBlock', properties: {} },
    { id: 'e3', source: 'h2', target: 'c2', label: 'hasBlock', properties: {} },
  ]
  
  const data: GraphData = { type: 'Graph', nodes, edges, metadata: {} }
  
  // 1. Derive Groups
  const groups = deriveMarkdownHeadingGroups(data)
  
  // Check Groups
  const gH1 = groups.find(g => g.id === 'md:h1')
  const gH2 = groups.find(g => g.id === 'md:h2')
  
  if (!gH1) throw new Error('H1 group not found')
  if (!gH2) throw new Error('H2 group not found')
  
  // Check Membership
  // H1 should contain c1 AND c2 (recursive)
  if (!gH1.memberNodeIds.includes('c1')) throw new Error('H1 should contain c1')
  if (!gH1.memberNodeIds.includes('c2')) throw new Error('H1 should contain c2 (crucial for nesting)')
  
  // H2 should contain c2
  if (!gH2.memberNodeIds.includes('c2')) throw new Error('H2 should contain c2')
  if (gH2.memberNodeIds.includes('c1')) throw new Error('H2 should not contain c1')
}
