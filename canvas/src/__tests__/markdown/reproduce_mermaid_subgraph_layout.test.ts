
import { applyMermaidLayout } from '../../components/GraphCanvas/layout/mermaid'
import { GraphNode, GraphEdge } from '../../lib/graph/types'
import { GraphSchema } from '../../lib/graph/schema'

export async function testMermaidSubgraphLayoutCoordinates() {
    // Create a simple graph: Subgraph A contains Node B
    const subgraph: GraphNode = {
      id: 'subgraphA',
      type: 'MermaidSubgraph',
      label: 'Subgraph A',
      properties: {
        subgraphName: 'subgraphA'
      }
    }

    const node: GraphNode = {
      id: 'nodeB',
      type: 'MermaidNode',
      label: 'Node B',
      properties: {
        mermaidSubgraphName: 'subgraphA'
      }
    }

    const nodes: GraphNode[] = [subgraph, node]
    const edges: GraphEdge[] = []
    
    const schema = {
        layout: {
            mermaid: {
                orientation: 'vertical',
                direction: 'source-target'
            }
        }
    } as GraphSchema

    // Apply layout
    applyMermaidLayout(nodes, edges, 800, 600, schema)

    // Check if subgraph has layout properties
    const subgraphProps = subgraph.properties || {}
    
    // Expect visual properties to be set
    if (subgraphProps['visual:x'] === undefined) throw new Error('visual:x is undefined')
    if (subgraphProps['visual:y'] === undefined) throw new Error('visual:y is undefined')
    if (subgraphProps['visual:width'] === undefined) throw new Error('visual:width is undefined')
    if (subgraphProps['visual:height'] === undefined) throw new Error('visual:height is undefined')
    
    // Width and height should be positive numbers (containing the node)
    if (Number(subgraphProps['visual:width']) <= 0) throw new Error('visual:width should be > 0')
    if (Number(subgraphProps['visual:height']) <= 0) throw new Error('visual:height should be > 0')

    await Promise.resolve()
}
