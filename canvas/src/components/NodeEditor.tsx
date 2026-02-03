import React, { useState, useEffect, useMemo } from 'react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData';
import { NODE_EDITOR_EMPTY_TEXT } from '@/lib/config';
import { GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types';
import { summarizePropertySpec, toCompactPropertyBadgeLabel, getNodePropSpec, buildNodeSchemaBadges, type GraphSchema } from '@/lib/graph/schema';
import { selectionPerfStart, selectionPerfEnd } from '@/lib/selectionPerf';
import {
  computeNeighborEdges,
  computeNeighborNodes,
  formatNodeFields,
  extractMediaFromProperties,
  isHttpUrl,
  getEndpointId,
} from '@/features/node-editor/utils';
import { getBadgeChipClass } from '@/lib/ui';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';
import { uiPrimaryLinkClassName, uiPrimaryLinkSmallClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';

export default function NodeEditor() {
  const graphData = useActiveGraphRenderData();
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId);
  const selectNode = useGraphStore(s => s.selectNode);
  const selectEdge = useGraphStore(s => s.selectEdge);
  const schema = useGraphStore(s => s.schema);
  const uiIconBadgeChipClass = useGraphStore(s => s.uiIconBadgeChipClass);
  const uiIconBadgeChipTextSizeClass = useGraphStore(s => s.uiIconBadgeChipTextSizeClass);
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  );
  const [node, setNode] = useState<GraphNode | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, { props: boolean; media: boolean; related: boolean; edges: boolean }>>({});
  const [expandedValues, setExpandedValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t0 = selectionPerfStart();
    if (!graphData || !selectedNodeId) {
      setNode(null);
      selectionPerfEnd('nodeEditor', t0);
      return;
    }
    const found = graphData.nodes.find(n => n.id === selectedNodeId);
    setNode(found || null);
    if (found) {
      setOpenSections(prev => {
        if (prev[selectedNodeId]) return prev;
        return { ...prev, [selectedNodeId]: { props: true, media: true, related: true, edges: true } };
      });
    }
    selectionPerfEnd('nodeEditor', t0);
  }, [graphData, selectedNodeId]);

  const neighborEdges: GraphEdge[] = useMemo(
    () => computeNeighborEdges(graphData, selectedNodeId),
    [graphData, selectedNodeId],
  );

  const neighborNodes: GraphNode[] = useMemo(
    () => computeNeighborNodes(graphData, selectedNodeId, neighborEdges),
    [graphData, selectedNodeId, neighborEdges],
  );

  const fields = useMemo(
    () => formatNodeFields(node, neighborEdges),
    [node, neighborEdges],
  );

  const media = useMemo(
    () => extractMediaFromProperties(node),
    [node],
  );

  if (!node) {
    return (
      <div className="p-4 text-sm text-gray-500">
        {NODE_EDITOR_EMPTY_TEXT}
      </div>
    );
  }

  const currentOpen = selectedNodeId ? openSections[selectedNodeId] : undefined;
  const reference = node.properties?.reference as JSONValue | undefined;
  const referenceUrl = typeof reference === 'string' && isHttpUrl(reference) ? reference : null;
  const schemaBadges = buildNodeSchemaBadges(
    schema as GraphSchema | null,
    node.type,
    node.properties as Record<string, unknown> | null | undefined,
  );

  return (
    <div className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="text-sm text-gray-800">
          {node.label} <span className="text-gray-500">({node.type})</span>
        </div>
        <div
          className={[
            'flex items-center gap-2 text-gray-600',
            uiPanelMicroLabelTextSizeClass,
          ].join(' ')}
        >
          <span className="break-all">{node.id}</span>
          <button
            onClick={() => navigator.clipboard.writeText(String(node.id))}
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
          >
            Copy
          </button>
          {referenceUrl && (
            <a
              href={referenceUrl}
              target="_blank"
              rel="noreferrer"
              className={uiPrimaryLinkClassName}
            >
              Reference
            </a>
          )}
        </div>
        {schemaBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {schemaBadges.map(badge => (
              <span
                key={badge.badge}
                className={getBadgeChipClass('neutral', {
                  baseClass: uiIconBadgeChipClass,
                  textSizeClass: uiIconBadgeChipTextSizeClass,
                })}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Properties</h3>
        {currentOpen && (
          <button
            onClick={() =>
              setOpenSections(s => ({
                ...s,
                [selectedNodeId!]: { ...s[selectedNodeId!], props: !s[selectedNodeId!].props },
              }))
            }
            className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
          >
            {currentOpen.props ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {(!currentOpen || currentOpen.props) && (
        <div className="space-y-2">
          {fields.map(row => {
            const v = row.value;
            const isUrl = typeof v === 'string' && isHttpUrl(v);
            const keyId = `${node.id}:${row.key}`;
            const isLongString =
              typeof v === 'string' && !isUrl && (v as string).length > 200;
            const spec = getNodePropSpec(schema as GraphSchema | null, node.type, row.key);
            const badges = summarizePropertySpec(spec);
            return (
              <div key={row.key}>
                <div className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                  <span>{row.key}</span>
                  {badges.length > 0 && (
                    <span className="inline-flex gap-0.5">
                      {badges.map(badge => (
                        <span
                          key={badge}
                          className={getBadgeChipClass('neutral', {
                            baseClass: uiIconBadgeChipClass,
                            textSizeClass: uiIconBadgeChipTextSizeClass,
                            extraClassName: 'leading-none border border-gray-300 px-[3px]',
                          })}
                          title={badge}
                        >
                          {toCompactPropertyBadgeLabel(badge)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-800 break-words">
                  {row.key === 'image' && isUrl && v ? (
                    <img src={v as string} alt="image" className="max-w-full h-auto rounded border" />
                  ) : row.key === 'reference' && isUrl ? (
                    <a
                      href={v as string}
                      target="_blank"
                      rel="noreferrer"
                      className={uiPrimaryLinkClassName}
                    >
                      {v as string}
                    </a>
                  ) : row.key === 'video' && isUrl ? (
                    <video src={v as string} controls className="w-full rounded border" />
                  ) : isLongString ? (
                    <>
                      <span>
                        {expandedValues[keyId] ? String(v) : `${String(v).slice(0, 200)}…`}
                      </span>
                      <div className="mt-1">
                        <button
                          onClick={() =>
                            setExpandedValues(s => ({ ...s, [keyId]: !s[keyId] }))
                          }
                          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                        >
                          {expandedValues[keyId] ? 'Show less' : 'Show more'}
                        </button>
                      </div>
                    </>
                  ) : typeof v === 'object' && v !== null ? (
                    <pre className="w-full px-2 py-1 border border-gray-300 rounded text-xs whitespace-pre-wrap break-words">
                      {JSON.stringify(v, null, 2)}
                    </pre>
                  ) : (
                    <span>{String(v)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(media.images.length > 0 || media.videos.length > 0) && (
        <div className="pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">Media</h4>
            {currentOpen && (
              <button
                onClick={() =>
                  setOpenSections(s => ({
                    ...s,
                    [selectedNodeId!]: { ...s[selectedNodeId!], media: !s[selectedNodeId!].media },
                  }))
                }
                className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
              >
                {currentOpen.media ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
          {(!currentOpen || currentOpen.related) && (
            <div className="space-y-2">
              {media.images.map((src, i) => (
                <img
                  key={`img-${i}`}
                  src={src}
                  alt="image"
                  className="max-w-full h-auto rounded border"
                />
              ))}
              {media.videos.map((src, i) => (
                <video
                  key={`vid-${i}`}
                  src={src}
                  controls
                  className="w-full rounded border"
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800">Related Nodes</h4>
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
              {neighborNodes.length}
            </span>
          </div>
          {currentOpen && (
            <button
              onClick={() =>
                setOpenSections(s => ({
                  ...s,
                  [selectedNodeId!]: {
                    ...s[selectedNodeId!],
                    related: !s[selectedNodeId!].related,
                  },
                }))
              }
              className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            >
              {currentOpen.related ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {neighborNodes.length === 0 ? (
          <div className="text-xs text-gray-500">None</div>
        ) : (
          (!currentOpen || currentOpen.related) && (
            <div className="space-y-2 h-48 overflow-y-auto pr-1">
              {neighborNodes.map(n => {
                const props = (n.properties ?? {}) as Record<string, JSONValue>;
                const imageVal = props.image;
                const referenceVal = props.reference;
                const img = isHttpUrl(imageVal) ? imageVal : null;
                const ref = isHttpUrl(referenceVal) ? referenceVal : null;
                return (
                  <div key={n.id} className="flex items-start gap-2">
                    {img && (
                      <img
                        src={img}
                        alt="image"
                        className="w-10 h-10 object-cover rounded border"
                      />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm ${UI_THEME_TOKENS.text.primary}`}>
                        {n.label}{' '}
                        <span className={UI_THEME_TOKENS.text.tertiary}>({n.type})</span>
                      </div>
                      <div className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{n.id}</div>
                      {ref && (
                        <a
                          href={ref}
                          target="_blank"
                          rel="noreferrer"
                          className={uiPrimaryLinkSmallClassName}
                        >
                          Reference
                        </a>
                      )}
                      <div className="mt-1">
                        <button
                          onClick={() => selectNode(n.id)}
                          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <div className="pt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800">Edges</h4>
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
              {neighborEdges.length}
            </span>
          </div>
          {currentOpen && (
            <button
              onClick={() =>
                setOpenSections(s => ({
                  ...s,
                  [selectedNodeId!]: { ...s[selectedNodeId!], edges: !s[selectedNodeId!].edges },
                }))
              }
              className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
            >
              {currentOpen.edges ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {neighborEdges.length === 0 ? (
          <div className="text-xs text-gray-500">None</div>
        ) : (
          (!currentOpen || currentOpen.edges) && (
            <div className="space-y-2">
              {neighborEdges.map(e => {
                const ep = (e.properties ?? {}) as Record<string, JSONValue>;
                const imgVal = ep.image;
                const vidVal = ep.video;
                const img = isHttpUrl(imgVal) ? imgVal : null;
                const vid = isHttpUrl(vidVal) ? vidVal : null;
                const isFocused =
                  selectedNodeId === null &&
                  selectedEdgeId !== null &&
                  e.id === selectedEdgeId;
                const sourceId = getEndpointId(e, 'source');
                const targetId = getEndpointId(e, 'target');
                return (
                  <div
                    key={e.id}
                    className={`space-y-1 rounded ${
                      isFocused ? 'bg-blue-50 border border-blue-200 p-2' : ''
                    }`}
                  >
                    <div
                      className={`text-xs ${
                        isFocused ? 'text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {e.label}: {sourceId} → {targetId}
                    </div>
                    {(img || vid) && (
                      <div className="flex items-center gap-2">
                        {img && (
                          <img
                            src={img}
                            alt="image"
                            className="w-10 h-10 object-cover rounded border"
                          />
                        )}
                        {vid && (
                          <video
                            src={vid}
                            controls
                            className="w-32 rounded border"
                          />
                        )}
                      </div>
                    )}
                    {Object.keys(ep).length > 0 && (
                      <pre className="w-full px-2 py-1 border border-gray-300 rounded text-xs whitespace-pre-wrap break-words">
                        {JSON.stringify(ep, null, 2)}
                      </pre>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectEdge(e.id)}
                        className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                      >
                        Focus Edge
                      </button>
                      <button
                        onClick={() => selectNode(sourceId)}
                        className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                      >
                        Open Source
                      </button>
                      <button
                        onClick={() => selectNode(targetId)}
                        className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
                      >
                        Open Target
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
