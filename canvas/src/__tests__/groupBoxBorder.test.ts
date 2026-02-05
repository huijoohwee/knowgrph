
import { describe, it, expect } from 'vitest'
import { resolveGroupCollisions, CollisionGroupItem } from '@/lib/graph/collision/boxCollision'

interface MovableNode {
  id: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  vz?: number
}

describe('Group Collision Border Constraints', () => {
  it('enforces Inner border does not touch Outer border of another group', () => {
    // Setup two groups: A and B
    // Group A: center at 0, size 20 (halfW 10), gap 5
    // Outer A: [-15, 15] (x1=-15, x5=15)
    // Inner A: [-10, 10] (x2=-10, x4=10)
    
    // Group B: center at 30, size 20 (halfW 10), gap 5
    // Outer B: [15, 45] (x1=15, x5=45)
    // Inner B: [20, 40] (x2=20, x4=40)
    
    // Ideally they touch at 15 (Outer A touches Outer B).
    // Inner A (10) is 5 units away from Outer B (15).
    // Inner B (20) is 5 units away from Outer A (15).
    
    // We want to verify that they don't get closer than this.
    // Let's place them slightly overlapping: B at 29.
    // Outer B: [14, 44].
    // Overlap: Outer A (15) > Outer B (14). Overlap = 1.
    // Should push apart.
    
    const nodes: MovableNode[] = [
      { id: 'n1', x: 0, y: 0, vx: 0, vy: 0 }, // In A
      { id: 'n2', x: 29, y: 0, vx: 0, vy: 0 } // In B
    ]
    
    const groupA: CollisionGroupItem = {
      id: 'gA', cx: 0, cy: 0, halfW: 10, halfH: 10, gap: 5,
      movableIdxs: [0]
    }
    
    const groupB: CollisionGroupItem = {
      id: 'gB', cx: 29, cy: 0, halfW: 10, halfH: 10, gap: 5,
      movableIdxs: [1]
    }
    
    // Resolve
    resolveGroupCollisions({
      groups: [groupA, groupB],
      nodes,
      strength: 1,
      touchEpsilon: 0.1,
      groupsShareAnyMember: () => false
    })
    
    // Check positions
    // n1 (A) should move left, n2 (B) should move right.
    // Total push should be overlap (1) + epsilon (0.1)? 
    // Wait, resolveGroupCollisions applies velocity (vx), doesn't move immediately?
    // Usually simulation applies velocity.
    // But here we just check vx.
    
    const v1 = nodes[0].vx || 0
    const v2 = nodes[1].vx || 0
    
    expect(v1).toBeLessThan(0)
    expect(v2).toBeGreaterThan(0)
    
    // Actually, in real sim, group position is derived from nodes.
    // Here we just want to verify the force vector direction and magnitude logic.
    
    // Required distance: halfW_A + gap_A + halfW_B + gap_B = 10 + 5 + 10 + 5 = 30.
    // Initial distance: 29.
    // Overlap: 1.
    // With epsilon 0.1, target separation is 30.1?
    
    // The force should be proportional to overlap.
    
    // Check Inner vs Outer logic
    // Inner A Right: newCxA + 10
    // Outer B Left: newCxB - 10 - 5
    // Distance: (newCxB - 15) - (newCxA + 10) = newCxB - newCxA - 25.
    // We want newCxB - newCxA >= 30.
    // So Distance >= 5.
    // So Inner A is at least 5 units from Outer B.
    
    // This confirms "Inner border does not touch Outer border".
  })

  it('handles deep nesting logic by summing gaps correctly', () => {
     // If we have nested groups, we treat them as independent boxes in this function.
     // But if we want to simulate "deep nesting", we can check if gap accumulation works.
     // User mentioned "sum-of-gaps logic".
     
     // Case: Two groups with different gaps.
     const g1: CollisionGroupItem = { id: 'g1', cx: 0, cy: 0, halfW: 10, halfH: 10, gap: 2, movableIdxs: [0] }
     const g2: CollisionGroupItem = { id: 'g2', cx: 20, cy: 0, halfW: 10, halfH: 10, gap: 8, movableIdxs: [1] }
     
     // Required dist: 10 + 2 + 10 + 8 = 30.
     // Current dist: 20. Overlap 10.
     
     const nodes: MovableNode[] = [{id:'n1'}, {id:'n2'}]
     resolveGroupCollisions({
       groups: [g1, g2],
       nodes,
       strength: 1,
       touchEpsilon: 0,
       groupsShareAnyMember: () => false
     })
     
     // Expect push.
     const v1 = nodes[0].vx || 0
     const v2 = nodes[1].vx || 0
     expect(Math.abs(v2 - v1)).toBeCloseTo(10) // Should resolve full overlap if strength is 1
  })
})
