import { injectLiveMarkdownDesignBlocksIntoSvgMarkup, injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored } from '@/lib/graph/svgSnapshot'

export async function testInjectLiveMarkdownDesignBlocksIntoSvgMarkupEmbedsForeignObject(): Promise<void> {
  const root = document.createElement('div')
  root.id = 'kg-root'
  document.body.appendChild(root)

  const block = document.createElement('article')
  block.setAttribute('data-kg-markdown-design-block', 'b1')
  block.setAttribute('data-kg-world-x', '10')
  block.setAttribute('data-kg-world-y', '20')
  block.setAttribute('data-kg-world-w', '300')
  block.setAttribute('data-kg-world-h', '120')
  block.style.background = 'rgb(255, 0, 0)'
  block.innerHTML = '<div><a href="https://example.com">Hello</a></div>'
  root.appendChild(block)

  const svgIn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g></g></svg>'
  const out = injectLiveMarkdownDesignBlocksIntoSvgMarkup(svgIn)
  if (!out || !out.includes('foreignObject')) throw new Error('Expected foreignObject injection')

  const doc = new DOMParser().parseFromString(out, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('Expected svg root')
  const fo = svg.querySelector('foreignObject')
  if (!fo) throw new Error('Expected foreignObject')
  if (fo.getAttribute('x') !== '10') throw new Error('Expected x=10')
  if (fo.getAttribute('y') !== '20') throw new Error('Expected y=20')
  if (fo.getAttribute('width') !== '300') throw new Error('Expected width=300')
  if (fo.getAttribute('height') !== '120') throw new Error('Expected height=120')
  const cloned = fo.querySelector('[data-kg-markdown-design-block="b1"]')
  if (!cloned) throw new Error('Expected cloned markdown block')
}

export async function testInjectLiveMarkdownDesignBlocksIntoSvgMarkupAnchoredUsesNodeCenter(): Promise<void> {
  const root = document.createElement('div')
  root.id = 'kg-root'
  document.body.appendChild(root)

  const block = document.createElement('article')
  block.setAttribute('data-kg-markdown-design-block', 'b1')
  block.setAttribute('data-kg-world-x', '10')
  block.setAttribute('data-kg-world-y', '20')
  block.setAttribute('data-kg-world-w', '300')
  block.setAttribute('data-kg-world-h', '120')
  root.appendChild(block)

  const svgIn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g></g></svg>'
  const out = injectLiveMarkdownDesignBlocksIntoSvgMarkupAnchored({
    svgMarkup: svgIn,
    anchorNodeIdByBlockId: { b1: 'n1' },
    nodePosById: { n1: { x: 100, y: 200 } },
  })
  const doc = new DOMParser().parseFromString(out, 'image/svg+xml')
  const fo = doc.querySelector('foreignObject')
  if (!fo) throw new Error('Expected foreignObject')
  if (fo.getAttribute('x') !== String(100 - 300 / 2)) throw new Error('Expected anchored x')
  if (fo.getAttribute('y') !== String(200 - 120 / 2)) throw new Error('Expected anchored y')
  if (fo.getAttribute('data-kg-anchor-node-id') !== 'n1') throw new Error('Expected data-kg-anchor-node-id')
}
