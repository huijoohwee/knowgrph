import { GraphData } from './types';

export const filterGraphToFrontmatterMermaid = (data: GraphData): GraphData => {
  const nodes = data.nodes.filter(n => {
    const props = n.properties || {};
    return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter';
  });

  const nodeIds = new Set(nodes.map(n => n.id));

  const edges = data.edges.filter(e => {
    const src = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source;
    const tgt = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target;
    return nodeIds.has(String(src)) && nodeIds.has(String(tgt));
  });

  return {
    ...data,
    nodes,
    edges,
  };
};
