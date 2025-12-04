import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FlowDiagramData } from '../types/flow';

interface FlowDiagramProps {
  data: FlowDiagramData;
  viewMode: 'flow' | 'graph' | 'timeline';
  editable?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  onNodePositionChange?: (id: string, x: number, y: number) => void;
}

export default function FlowDiagram({ data, viewMode, editable = false, selectedNodeId, onSelectNode, onNodePositionChange }: FlowDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Create main group for zoom/pan
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    // Create arrow markers for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#6b7280')
      .style('stroke', 'none');

    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.edges).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Create links
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.edges)
      .enter().append('line')
      .attr('stroke', (d: any) => {
        switch (d.edge_type) {
          case 'conditional': return '#f59e0b';
          case 'loop': return '#ef4444';
          default: return '#6b7280';
        }
      })
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Create link labels
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(data.edges)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text((d: any) => d.label || '');

    // Create nodes
    const nodes = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
          if (editable && onNodePositionChange) {
            onNodePositionChange(d.id, d.x, d.y);
          }
        }));

    // Add node shapes based on type
    nodes.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('x', -60)
      .attr('y', -20)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (d: any) => {
        switch (d.node_type) {
          case 'input': return '#dbeafe';
          case 'output': return '#dcfce7';
          case 'decision': return '#fef3c7';
          default: return '#f3f4f6';
        }
      })
      .attr('stroke', (d: any) => {
        switch (d.node_type) {
          case 'input': return '#3b82f6';
          case 'output': return '#10b981';
          case 'decision': return '#f59e0b';
          default: return '#6b7280';
        }
      })
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .on('click', (event, d: any) => {
        if (onSelectNode) {
          onSelectNode(selectedNodeId === d.id ? null : d.id);
        }
      });

    // Add node text
    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#1f2937')
      .text((d: any) => d.label)
      .each(function(d: any) {
        const text = d3.select(this);
        const words = d.label.split(' ');
        if (words.length > 2) {
          text.text('');
          words.forEach((word: string, i: number) => {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', i === 0 ? '-0.3em' : '1.2em')
              .attr('font-size', '10px')
              .text(word);
          });
        }
      });

    // Add tooltips
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    nodes.on('mouseover', (event, d: any) => {
      tooltip.transition().duration(200).style('opacity', .9);
      tooltip.html(`<strong>${d.label}</strong><br/>Type: ${d.node_type}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(500).style('opacity', 0);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Highlight selected node
    if (selectedNodeId) {
      nodes.select('rect')
        .attr('stroke-width', (d: any) => d.id === selectedNodeId ? 4 : 2)
        .attr('stroke', (d: any) => d.id === selectedNodeId ? '#1d4ed8' : null);
    }

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, selectedNodeId, viewMode, editable]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy,
        1.2
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy,
        0.8
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform,
        d3.zoomIdentity
      );
      if (onSelectNode) onSelectNode(null);
    }
  };

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Reset View"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-white p-3 rounded-lg shadow-sm border">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-500 rounded"></div>
            <span>Input</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-500 rounded"></div>
            <span>Process</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-100 border border-green-500 rounded"></div>
            <span>Output</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-500 rounded"></div>
            <span>Decision</span>
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <svg
        ref={svgRef}
        width="100%"
        height="600"
        className="border border-gray-200 rounded-lg bg-white"
      />

      {/* Status */}
      <div className="mt-2 text-sm text-gray-600">
        Zoom: {Math.round(zoom * 100)}% | Click nodes to select | Drag to pan
      </div>
    </div>
  );
}
