import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SvgPaintUsesStyleForCssVars() {
  const read = (...parts: string[]) => readFileSync(resolve(process.cwd(), ...parts), 'utf8')

  const links = read('src', 'components', 'GraphCanvas', 'layers', 'links.ts')
  if (!links.includes(".style('stroke', (d: GraphEdge) => getEdgeBaseStroke")) {
    throw new Error("expected links layer to set edge stroke via style()")
  }
  if (links.includes(".attr('stroke', (d: GraphEdge) => getEdgeBaseStroke")) {
    throw new Error("expected links layer to avoid attr('stroke', ...) for css var compatibility")
  }

  const defs = read('src', 'components', 'GraphCanvas', 'layers', 'defs.ts')
  if (!defs.includes(".style('fill', 'var(--kg-canvas-edge-stroke)')")) {
    throw new Error('expected defs arrowhead fill to be set via style()')
  }

  const styles = read('src', 'components', 'GraphCanvas', 'useGraphCanvasStyles.ts')
  if (!styles.includes("linksSelRef.current.style('stroke'")) {
    throw new Error('expected GraphCanvas styles to apply link stroke via style()')
  }
  if (!styles.includes("labelsSelRef.current\n        .attr('font-size'")) {
    throw new Error('expected GraphCanvas styles to still control label font size')
  }

  const groups = read('src', 'components', 'GraphCanvas', 'layers', 'groups.ts')
  if (!groups.includes(".style('stroke', d => d.style.stroke")) {
    throw new Error('expected groups layer to set stroke via style()')
  }
  if (groups.includes(".attr('stroke', d => d.style.stroke")) {
    throw new Error("expected groups layer to avoid attr('stroke', ...) for css var compatibility")
  }

  const nodes = read('src', 'components', 'GraphCanvas', 'layers', 'nodes.ts')
  if (!nodes.includes(".style('fill', (d: GraphNode) =>")) {
    throw new Error('expected nodes layer to set node fill via style()')
  }
  if (!nodes.includes(".style('stroke', (d: GraphNode) =>")) {
    throw new Error('expected nodes layer to set node stroke via style()')
  }
}

