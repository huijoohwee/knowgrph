import { GraphEdge } from './types';

export const edgeExists = (edges: GraphEdge[], a: string, b: string, label?: string) => {
  return edges.some((e) => {
    const same = (String(e.source) === a && String(e.target) === b) || (String(e.source) === b && String(e.target) === a);
    return label ? same && e.label === label : same;
  });
};

