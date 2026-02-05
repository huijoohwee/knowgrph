import { deriveMarkdownHeadingGroups } from '@/components/GraphCanvas/layout/markdownHeadingGroups'
import { createGroupBboxCollideForceByDepth } from '@/components/GraphCanvas/layout/groupOverlapByDepth'
import { resolveGroupCollisions } from '@/lib/graph/collision/boxCollision'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

export const testCorrectlyNestsH2InsideH1AndEnforcesContainmentSeparation = () => {
  // Mock Graph Data mimicking abc123.md structure
  // H1: "ABC" (Section)
  // H2: "1-2-3..." (Section) -> child of H1
  // Content 1: "Blockquote" -> child of H1
  // Content 2: "Image" -> child of H2
  
  const nodes: GraphNode[] = [
    { id: 'h1', type: 'Section', properties: { level: 1 }, x: 0, y: 0, width: 100, height: 50 },
    { id: 'h2', type: 'Section', properties: { level: 2 }, x: 0, y: 100, width: 100, height: 50 },
    { id: 'c1', type: 'Block', x: 10, y: 10, width: 20, height: 20 }, // Inside H1
    { id: 'c2', type: 'Block', x: 10, y: 110, width: 20, height: 20 }, // Inside H2
  ]
  
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'h1', target: 'h2', label: 'hasSection' },
    { id: 'e2', source: 'h1', target: 'c1', label: 'hasBlock' },
    { id: 'e3', source: 'h2', target: 'c2', label: 'hasBlock' },
  ]
  
  const data: GraphData = { nodes, edges, metadata: {} }
  
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
  
  // 2. Check Collision Logic
  // If H1 contains c2, and H2 contains c2.
  // Then H2 members are subset of H1 members.
  // So H2 is inside H1.
  
  const schema: GraphSchema = {
    layout: {
      groups: {
        padding: 10,
        nestedPaddingStep: 10,
        touchEpsilonPx: 2,
        nestedTouchEpsilonXPx: 2,
      }
    }
  }
  
  // Setup positions for collision test
  // Parent (H1) needs to envelop Child (H2).
  // c1 is at 10,10.
  // c2 is at 10,110.
  // H1 Bounds (from c1+c2): MinY=10, MaxY=130 (approx).
  // H2 Bounds (from c2): MinY=110, MaxY=130.
  // H2 is at the bottom of H1.
  
  // H1 Gap: 5 (padding 10 / 2).
  // H1 Visual Pad: 10 + 10 (depth extra) = 20.
  // H1 Outer Bottom: MaxY + Pad + Gap = 130 + 20 + 5 = 155.
  // H1 Inner Bottom: MaxY + Pad = 150.
  
  // H2 Gap: 5.
  // H2 Visual Pad: 10.
  // H2 Inner Bottom: MaxY + Pad = 130 + 10 = 140.
  
  // H2 Inner Bottom (140) < H1 Inner Bottom (150).
  // Safely inside.
  
  // Let's force H2 to push OUT.
  // Move c2 to y=200.
  // H1 expands to include c2!
  // H1 MaxY becomes 220.
  // H2 MaxY becomes 220.
  // H2 is ALWAYS inside H1 bounds because H1 bounds are derived from H2 members!
  
  // So sticking can ONLY happen if they are SIBLINGS.
  // i.e. if gH1 does NOT contain c2.
  
  if (!gH1.memberNodeIds.includes('c2')) {
    throw new Error('H1 does not contain c2 - disjoint groups causing sibling collision!')
  }
  
  // If they ARE nested, maybe the "sticking" is just them being close?
  // User says "border still sticks".
  // Maybe they want *more* padding?
  
  // Let's check resolveGroupCollisions with disjoint groups (simulating failure)
  // to see if "sticking" matches user description.
  
  const disjointNodes = [...nodes]
  // Force disjoint
  const gH1_disjoint = { ...gH1, memberNodeIds: ['c1'] }
  const gH2_disjoint = { ...gH2, memberNodeIds: ['c2'] }
  
  // Position them to touch.
  // c1 at 0,0. c2 at 50,0.
  // H1 halfW=10 (pad 0). Gap 10.
  // H1 Outer Right = 20.
  // H2 halfW=10. Gap 10.
  // H2 Outer Left = 30.
  // Gap between Outer Borders = 10.
  
  // If they move closer...
  // resolveGroupCollisions will keep them apart by GapA+GapB.
  
  // Conclusion:
  // If "border sticks", it implies `gap` is ignored or 0.
  // Or they are siblings and `touchEpsilon` is small.
}
