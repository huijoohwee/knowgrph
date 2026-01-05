import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation';

export const attachEdgeCreateHandlers = (
  svgEl: SVGSVGElement,
  tempLinkSelRef: MutableRefObject<TempLinkSelection>,
  linkDragRef: MutableRefObject<PendingLink | null>,
) => {
  const svg = d3.select(svgEl);
  svg.on('mousemove', (ev: MouseEvent) => {
    if (!tempLinkSelRef.current || !linkDragRef.current) return;
    const transform = d3.zoomTransform(svgEl);
    const point = transform.invert([ev.offsetX, ev.offsetY]);
    tempLinkSelRef.current.attr('x2', point[0]).attr('y2', point[1]);
  });
  svg.on('mouseup', () => {
    if (!tempLinkSelRef.current || !linkDragRef.current) return;
    tempLinkSelRef.current.style('display', 'none');
    linkDragRef.current = null;
  });
};
