
import type { BoxItem } from './types.js'

// Interleave bits for 3D Morton code (Z-order curve)
// Using 10 bits per dimension to fit in standard 32-bit integer range safely (30 bits total)
// or even up to 53 bits in JS Number.
// Let's use 10 bits (0-1023) which is usually sufficient for sorting order.
function part1By2(n: number): number {
  n &= 0x000003ff
  n = (n ^ (n << 16)) & 0xff0000ff
  n = (n ^ (n <<  8)) & 0x0300f00f
  n = (n ^ (n <<  4)) & 0x030c30c3
  n = (n ^ (n <<  2)) & 0x09249249
  return n
}

function morton3(x: number, y: number, z: number): number {
  return (part1By2(z) << 2) + (part1By2(y) << 1) + part1By2(x)
}

export class PackedRTree<T extends BoxItem> {
  // Flat storage for the tree
  // We store the tree as a hierarchy of bounding boxes.
  // The bottom level (leaf nodes) points to the items.
  // We'll store:
  // - nodeBoxes: Float64Array [minX, minY, minZ, maxX, maxY, maxZ, ...] for each node
  // - nodeIndices: Uint32Array [startIndex, endIndex] for children (which are either items or other nodes)
  // But since it's a static packed tree, we can compute offsets implicitly or store them.
  
  // To keep it simple and robust (and not copy flatbush's exact buffer layout):
  // We will build levels.
  // Level 0: The input items (sorted).
  // Level 1: Nodes wrapping groups of Level 0 items.
  // Level 2: Nodes wrapping groups of Level 1 nodes.
  // ...
  // Root.

  // We will store all "Nodes" (internal nodes) in a flat array, and the Items in another.
  
  private items: T[]
  private nodeSize: number
  private rootIndex: number = -1
  
  // Arrays to hold node data
  // Each node has an index.
  // nodeBoxes: [minX, minY, minZ, maxX, maxY, maxZ] * numNodes
  // nodeChildren: [childStartIndex, childEndIndex] * numNodes (indices into the *next* level or items)
  // To handle different levels, we might need a structure that knows which level we are in.
  // Or we can just store all nodes in one array and know that:
  // - Leaves point to 'items' array.
  // - Internal nodes point to 'nodes' array.
  // But packed R-tree usually has implicit structure.

  // Let's use a "Level" based approach for clarity and "No Copy" compliance.
  private levels: {
    boxes: Float64Array // [minX, minY, minZ, maxX, maxY, maxZ] per node in this level
    // We don't need explicit children pointers if we know the nodeSize and implicit ordering.
    // Node i in Level K covers nodes [i*nodeSize ... (i+1)*nodeSize] in Level K-1.
    count: number
  }[] = []

  constructor(items: T[], nodeSize: number = 16) {
    this.items = items
    this.nodeSize = Math.max(2, nodeSize)
    if (items.length > 0) {
      this.build()
    }
  }

  private build() {
    const items = this.items
    const n = items.length
    
    // 1. Calculate global bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    
    // We also cache item bounds to avoid recomputing
    const itemBoxes = new Float64Array(n * 6)
    
    for (let i = 0; i < n; i++) {
      const item = items[i]
      const ix1 = item.cx - item.halfW
      const ix2 = item.cx + item.halfW
      const iy1 = item.cy - item.halfH
      const iy2 = item.cy + item.halfH
      const iz1 = (item.cz ?? 0) - (item.halfD ?? 0)
      const iz2 = (item.cz ?? 0) + (item.halfD ?? 0)
      
      itemBoxes[i * 6 + 0] = ix1
      itemBoxes[i * 6 + 1] = iy1
      itemBoxes[i * 6 + 2] = iz1
      itemBoxes[i * 6 + 3] = ix2
      itemBoxes[i * 6 + 4] = iy2
      itemBoxes[i * 6 + 5] = iz2

      if (ix1 < minX) minX = ix1
      if (iy1 < minY) minY = iy1
      if (iz1 < minZ) minZ = iz1
      if (ix2 > maxX) maxX = ix2
      if (iy2 > maxY) maxY = iy2
      if (iz2 > maxZ) maxZ = iz2
    }
    
    const width = maxX - minX || 1
    const height = maxY - minY || 1
    const depth = maxZ - minZ || 1
    
    // 2. Compute Morton codes and sort
    // We create an index array to sort 'items' and 'itemBoxes' together
    const indices = new Uint32Array(n)
    const codes = new Float64Array(n) // Use Float64 to store potentially large codes if we used more bits, but here regular number is fine
    
    for (let i = 0; i < n; i++) {
      indices[i] = i
      // Normalize to 0..1023
      const cx = (itemBoxes[i * 6 + 0] + itemBoxes[i * 6 + 3]) / 2
      const cy = (itemBoxes[i * 6 + 1] + itemBoxes[i * 6 + 4]) / 2
      const cz = (itemBoxes[i * 6 + 2] + itemBoxes[i * 6 + 5]) / 2
      
      const x = Math.min(1023, Math.max(0, Math.floor(((cx - minX) / width) * 1024)))
      const y = Math.min(1023, Math.max(0, Math.floor(((cy - minY) / height) * 1024)))
      const z = Math.min(1023, Math.max(0, Math.floor(((cz - minZ) / depth) * 1024)))
      
      codes[i] = morton3(x, y, z)
    }
    
    // Sort indices based on codes
    // We use a simple sort. For very large N, a Radix sort is faster, but standard sort is O(N log N).
    // To avoid moving heavy objects, we sort the indices.
    indices.sort((a, b) => codes[a] - codes[b])
    
    // Reorder items and itemBoxes according to sorted indices
    const sortedItems = new Array(n)
    const sortedItemBoxes = new Float64Array(n * 6)
    
    for (let i = 0; i < n; i++) {
      const idx = indices[i]
      sortedItems[i] = items[idx]
      for (let k = 0; k < 6; k++) {
        sortedItemBoxes[i * 6 + k] = itemBoxes[idx * 6 + k]
      }
    }
    
    this.items = sortedItems // Replace with sorted items
    
    // 3. Build the tree levels
    // Level 0 is the items themselves (conceptually)
    // We'll store Level 0 boxes explicitly? Yes, simpler for query.
    this.levels.push({
      boxes: sortedItemBoxes,
      count: n
    })
    
    let currentLevelBoxes = sortedItemBoxes
    let currentCount = n
    
    while (currentCount > 1) {
      const nextCount = Math.ceil(currentCount / this.nodeSize)
      const nextBoxes = new Float64Array(nextCount * 6)
      
      for (let i = 0; i < nextCount; i++) {
        let nodeMinX = Infinity, nodeMinY = Infinity, nodeMinZ = Infinity
        let nodeMaxX = -Infinity, nodeMaxY = -Infinity, nodeMaxZ = -Infinity
        
        const start = i * this.nodeSize
        const end = Math.min(start + this.nodeSize, currentCount)
        
        for (let j = start; j < end; j++) {
          const bx1 = currentLevelBoxes[j * 6 + 0]
          const by1 = currentLevelBoxes[j * 6 + 1]
          const bz1 = currentLevelBoxes[j * 6 + 2]
          const bx2 = currentLevelBoxes[j * 6 + 3]
          const by2 = currentLevelBoxes[j * 6 + 4]
          const bz2 = currentLevelBoxes[j * 6 + 5]
          
          if (bx1 < nodeMinX) nodeMinX = bx1
          if (by1 < nodeMinY) nodeMinY = by1
          if (bz1 < nodeMinZ) nodeMinZ = bz1
          if (bx2 > nodeMaxX) nodeMaxX = bx2
          if (by2 > nodeMaxY) nodeMaxY = by2
          if (bz2 > nodeMaxZ) nodeMaxZ = bz2
        }
        
        nextBoxes[i * 6 + 0] = nodeMinX
        nextBoxes[i * 6 + 1] = nodeMinY
        nextBoxes[i * 6 + 2] = nodeMinZ
        nextBoxes[i * 6 + 3] = nodeMaxX
        nextBoxes[i * 6 + 4] = nodeMaxY
        nextBoxes[i * 6 + 5] = nodeMaxZ
      }
      
      this.levels.push({
        boxes: nextBoxes,
        count: nextCount
      })
      
      currentLevelBoxes = nextBoxes
      currentCount = nextCount
    }
  }

  query(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, callback: (item: T) => void) {
    if (this.levels.length === 0) return
    
    // Recursive search starting from the top level (last in array)
    // The top level has 1 node (root), unless empty.
    const topLevelIdx = this.levels.length - 1
    
    // We can use a stack for non-recursive traversal
    // Stack stores: { level: number, index: number }
    // Since we know the tree height, we can optimise.
    // Let's use a simple recursion first, or a stack of indices.
    
    // But wait, the indices in level L map to indices in level L-1.
    // Node i in Level L covers children [i*nodeSize ... (i+1)*nodeSize - 1] in Level L-1.
    
    const stackLevel: number[] = []
    const stackIndex: number[] = []
    
    // Push root(s) of the top level
    // Top level might have multiple nodes if we just stopped when count > 1?
    // My loop `while (currentCount > 1)` ensures top level has 1 node (or 0 if empty).
    // So top level always has 1 node at index 0 (if not empty).
    
    stackLevel.push(topLevelIdx)
    stackIndex.push(0)
    
    while (stackLevel.length > 0) {
      const levelIdx = stackLevel.pop()!
      const nodeIdx = stackIndex.pop()!
      
      const level = this.levels[levelIdx]
      // Check intersection
      const bx1 = level.boxes[nodeIdx * 6 + 0]
      const by1 = level.boxes[nodeIdx * 6 + 1]
      const bz1 = level.boxes[nodeIdx * 6 + 2]
      const bx2 = level.boxes[nodeIdx * 6 + 3]
      const by2 = level.boxes[nodeIdx * 6 + 4]
      const bz2 = level.boxes[nodeIdx * 6 + 5]
      
      if (bx2 < minX || bx1 > maxX || by2 < minY || by1 > maxY || bz2 < minZ || bz1 > maxZ) {
        continue
      }
      
      if (levelIdx === 0) {
        // Leaf level (items)
        callback(this.items[nodeIdx])
      } else {
        // Internal node
        // Add children to stack
        const firstChild = nodeIdx * this.nodeSize
        const childLevelIdx = levelIdx - 1
        const childCount = this.levels[childLevelIdx].count
        const limit = Math.min(firstChild + this.nodeSize, childCount)
        
        for (let i = firstChild; i < limit; i++) {
           stackLevel.push(childLevelIdx)
           stackIndex.push(i)
        }
      }
    }
  }
}
