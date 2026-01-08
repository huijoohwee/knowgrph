import * as d3 from 'd3';

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>;

export const createDefs = (svg: SvgSelection) => {
  const defs = svg.append('defs');
  defs
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
    .attr('fill', '#999');
  defs
    .append('clipPath')
    .attr('id', 'node-media-circle-clip')
    .attr('clipPathUnits', 'objectBoundingBox')
    .append('circle')
    .attr('cx', 0.5)
    .attr('cy', 0.5)
    .attr('r', 0.5);
  defs
    .append('clipPath')
    .attr('id', 'node-media-rect-clip')
    .attr('clipPathUnits', 'objectBoundingBox')
    .append('rect')
    .attr('x', 0.05)
    .attr('y', 0.05)
    .attr('width', 0.9)
    .attr('height', 0.9)
    .attr('rx', 0.08)
    .attr('ry', 0.08);
};
