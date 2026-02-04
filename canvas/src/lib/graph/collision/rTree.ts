
import type { BoxItem } from './types'

function morton2(x: number, y: number): number {
  x = (x | (x << 8)) & 0x00FF00FF
  x = (x | (x << 4)) & 0x0F0F0F0F
  x = (x | (x << 2)) & 0x33333333
  x = (x | (x << 1)) & 0x55555555
  
  y = (y | (y << 8)) & 0x00FF00FF
  y = (y | (y << 4)) & 0x0F0F0F0F
  y = (y | (y << 2)) & 0x33333333
  y = (y | (y << 1)) & 0x55555555
  
  return x | (y << 1)
}

interface Node {
  minX: number
  minY: number
  maxX: number
  maxY: number
  height: number
  leaf: boolean
  children: (Node | number)[]
}

export class PackedRTree<T extends BoxItem> {
  private root: Node | null = null
  private items: T[]
  private nodeSize: number

  constructor(items: T[], nodeSize: number = 16) {
    this.items = items
    this.nodeSize = Math.max(4, nodeSize)
    if (items.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const proxies = items.map((item, index) => {
      const itemMinX = item.cx - item.halfW
      const itemMaxX = item.cx + item.halfW
      const itemMinY = item.cy - item.halfH
      const itemMaxY = item.cy + item.halfH
      
      if (itemMinX < minX) minX = itemMinX
      if (itemMinY < minY) minY = itemMinY
      if (itemMaxX > maxX) maxX = itemMaxX
      if (itemMaxY > maxY) maxY = itemMaxY
      
      return { index, cx: item.cx, cy: item.cy, minX: itemMinX, minY: itemMinY, maxX: itemMaxX, maxY: itemMaxY }
    })

    const width = maxX - minX || 1
    const height = maxY - minY || 1
    
    proxies.sort((a, b) => {
      const ax = Math.floor(((a.cx - minX) / width) * 65535)
      const ay = Math.floor(((a.cy - minY) / height) * 65535)
      const bx = Math.floor(((b.cx - minX) / width) * 65535)
      const by = Math.floor(((b.cy - minY) / height) * 65535)
      return morton2(ax, ay) - morton2(bx, by)
    })

    let nodes: Node[] = []
    
    for (let i = 0; i < proxies.length; i += this.nodeSize) {
      const childrenProxies = proxies.slice(i, Math.min(i + this.nodeSize, proxies.length))
      const node: Node = {
        minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
        height: 1,
        leaf: true,
        children: childrenProxies.map(p => p.index)
      }
      
      for (const p of childrenProxies) {
        if (p.minX < node.minX) node.minX = p.minX
        if (p.minY < node.minY) node.minY = p.minY
        if (p.maxX > node.maxX) node.maxX = p.maxX
        if (p.maxY > node.maxY) node.maxY = p.maxY
      }
      nodes.push(node)
    }

    while (nodes.length > 1) {
      const nextLevel: Node[] = []
      for (let i = 0; i < nodes.length; i += this.nodeSize) {
        const children = nodes.slice(i, Math.min(i + this.nodeSize, nodes.length))
        const node: Node = {
          minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
          height: children[0].height + 1,
          leaf: false,
          children: children
        }

        for (const child of children) {
          if (child.minX < node.minX) node.minX = child.minX
          if (child.minY < node.minY) node.minY = child.minY
          if (child.maxX > node.maxX) node.maxX = child.maxX
          if (child.maxY > node.maxY) node.maxY = child.maxY
        }
        nextLevel.push(node)
      }
      nodes = nextLevel
    }

    if (nodes.length > 0) {
      this.root = nodes[0]
    }
  }

  query(minX: number, minY: number, maxX: number, maxY: number, callback: (item: T) => void) {
    if (!this.root) return

    const stack: Node[] = [this.root]
    while (stack.length > 0) {
      const node = stack.pop()!
      
      if (node.maxX < minX || node.minX > maxX || node.maxY < minY || node.minY > maxY) {
        continue
      }

      if (node.leaf) {
        for (const childIndex of node.children as number[]) {
          const item = this.items[childIndex]
          const itemMinX = item.cx - item.halfW
          const itemMaxX = item.cx + item.halfW
          const itemMinY = item.cy - item.halfH
          const itemMaxY = item.cy + item.halfH

          if (itemMaxX >= minX && itemMinX <= maxX && itemMaxY >= minY && itemMinY <= maxY) {
            callback(item)
          }
        }
      } else {
        for (const child of node.children as Node[]) {
           if (child.maxX >= minX && child.minX <= maxX && child.maxY >= minY && child.minY <= maxY) {
             stack.push(child)
           }
        }
      }
    }
  }
}
