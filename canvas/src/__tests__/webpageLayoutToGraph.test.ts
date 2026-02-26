import { convertWebpageLayoutToGraphData } from '@/lib/websites/webpageLayoutToGraph'

import type { WebpageLayoutSnapshot } from '@/lib/websites/webpageLayoutExport'
import type { GraphNode, JSONValue } from '@/lib/graph/types'

export function testWebpageLayoutToGraphCentersAndFilters() {
  const snap: WebpageLayoutSnapshot = {
    meta: {
      kind: 'layout',
      title: 'Astro',
      href: 'https://astro.build/',
      viewport: { w: 1000, h: 800 },
      scroll: { x: 0, y: 0, height: 3000 },
      ts: 1,
    },
    elements: [
      {
        id: 'e1',
        pid: '',
        tag: 'HEADER',
        rect: { x: 0, y: 0, w: 1000, h: 80 },
        text: 'Header',
        attrs: { id: 'top', class: 'site-header', role: '', href: '', src: '', alt: '' },
        style: {
          display: 'block',
          position: 'sticky',
          zIndex: '10',
          backgroundColor: 'rgb(255, 0, 0)',
          color: 'rgb(0, 0, 0)',
          borderRadius: '0px',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: '0px',
          fontSize: '16px',
          fontWeight: '700',
          lineHeight: '20px',
          opacity: '1',
        },
      },
      {
        id: 'e2',
        pid: 'e1',
        tag: 'DIV',
        rect: { x: 10, y: 10, w: 10, h: 5 },
        text: 'Tiny',
        attrs: { id: '', class: '', role: '', href: '', src: '', alt: '' },
        style: {
          display: 'block',
          position: 'static',
          zIndex: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: 'rgb(0, 0, 0)',
          borderRadius: '0px',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: '0px',
          fontSize: '12px',
          fontWeight: '400',
          lineHeight: '16px',
          opacity: '1',
        },
      },
      {
        id: 'e3',
        pid: '',
        tag: 'MAIN',
        rect: { x: 0, y: 120, w: 1000, h: 900 },
        text: 'Main',
        attrs: { id: '', class: 'main', role: 'main', href: '', src: '', alt: '' },
        style: {
          display: 'block',
          position: 'static',
          zIndex: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          color: 'rgb(0, 0, 0)',
          borderRadius: '12px',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: '2px',
          fontSize: '16px',
          fontWeight: '400',
          lineHeight: '20px',
          opacity: '0.9',
        },
      },
      {
        id: 'e4',
        pid: 'e3',
        tag: 'BUTTON',
        rect: { x: 40, y: 160, w: 80, h: 24 },
        text: 'Buy',
        attrs: { id: '', class: 'btn', role: '', href: '', src: '', alt: '' },
        style: {
          display: 'inline-block',
          position: 'static',
          zIndex: 'auto',
          backgroundColor: 'rgb(0, 0, 0)',
          color: 'rgb(255, 255, 255)',
          borderRadius: '6px',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: '1px',
          fontSize: '12px',
          fontWeight: '600',
          lineHeight: '16px',
          opacity: '1',
        },
      },
    ],
  }

  const graph = convertWebpageLayoutToGraphData(snap, { maxNodes: 1200, minAreaPx: 9000 })
  const ids = new Set((graph.nodes || []).map(n => String(n.id)))
  if (!ids.has('e1')) throw new Error('expected to keep large header')
  if (!ids.has('e3')) throw new Error('expected to keep large main')
  if (!ids.has('e4')) throw new Error('expected to keep small interactive button')
  if (ids.has('e2')) throw new Error('expected to drop tiny non-semantic div')

  let minLeft = Infinity
  let maxRight = -Infinity
  let minTop = Infinity
  let maxBottom = -Infinity
  for (const raw of graph.nodes || []) {
    const n = raw as GraphNode
    const props = (n.properties || {}) as Record<string, JSONValue>
    const w = typeof props['visual:width'] === 'number' ? (props['visual:width'] as number) : 0
    const h = typeof props['visual:height'] === 'number' ? (props['visual:height'] as number) : 0
    const x = typeof n.x === 'number' ? n.x : 0
    const y = typeof n.y === 'number' ? n.y : 0
    minLeft = Math.min(minLeft, x - w / 2)
    maxRight = Math.max(maxRight, x + w / 2)
    minTop = Math.min(minTop, y - h / 2)
    maxBottom = Math.max(maxBottom, y + h / 2)
  }
  const cx = (minLeft + maxRight) / 2
  const cy = (minTop + maxBottom) / 2
  if (Math.abs(cx) > 1e-6 || Math.abs(cy) > 1e-6) throw new Error('expected centered bounding box')

  const header = (graph.nodes || []).find(n => String(n.id) === 'e1') as GraphNode | undefined
  if (!header) throw new Error('missing header node')
  const headerFill = (header.properties as Record<string, JSONValue>)['visual:fill']
  if (typeof headerFill !== 'string' || !headerFill.includes('rgb(255')) throw new Error('expected visual:fill from backgroundColor')

  const main = (graph.nodes || []).find(n => String(n.id) === 'e3') as GraphNode | undefined
  if (!main) throw new Error('missing main node')
  const mainFill = (main.properties as Record<string, JSONValue>)['visual:fill']
  if (typeof mainFill === 'string' && mainFill.trim()) throw new Error('expected transparent background to omit visual:fill')
}

