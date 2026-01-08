import { useEffect } from 'react';
import { GraphData } from '@/lib/graph/types';
import { 
  startEdgeFromNode, 
  startUpdateEdgeEndpoint, 
  PendingLink, 
  TempLinkSelection 
} from '@/features/edge-creation';

interface UseEdgeCreationEffectProps {
  edgeCreationRequest: { type: 'create' | 'update-source' | 'update-target'; fromId?: string; toId?: string } | null;
  graphData: GraphData | null;
  selectedEdgeId: string | null;
  tempLinkSelRef: React.MutableRefObject<TempLinkSelection>;
  linkDragRef: React.MutableRefObject<PendingLink | null>;
  clearEdgeCreationRequest: () => void;
  selectEdge: (id: string | null) => void;
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void;
}

export function useEdgeCreationEffect({
  edgeCreationRequest,
  graphData,
  selectedEdgeId,
  tempLinkSelRef,
  linkDragRef,
  clearEdgeCreationRequest,
  selectEdge,
  setSelectionSource,
}: UseEdgeCreationEffectProps) {
  useEffect(() => {
    if (!edgeCreationRequest || !graphData) return;
    const n = graphData.nodes.find(x => x.id === edgeCreationRequest.fromId);
    if (!n) { clearEdgeCreationRequest(); return; }
    
    if (edgeCreationRequest.type === 'create') {
      startEdgeFromNode(n, tempLinkSelRef, linkDragRef);
    } else {
      const sel = selectedEdgeId ? graphData.edges.find(e => e.id === selectedEdgeId) : null;
      if (sel) {
        // Wrappers to ensure correct type matching if needed, though strict types should match
        const selectEdgeNonNull = (id: string) => selectEdge(id);
        const setSelectionSourceStrict = (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => setSelectionSource(src);
        
        startUpdateEdgeEndpoint(
          sel, 
          n, 
          edgeCreationRequest.type, 
          tempLinkSelRef, 
          linkDragRef, 
          selectEdgeNonNull, 
          setSelectionSourceStrict
        );
      } else {
        startEdgeFromNode(n, tempLinkSelRef, linkDragRef);
      }
    }
    clearEdgeCreationRequest();
  }, [
    edgeCreationRequest, 
    graphData, 
    selectedEdgeId, 
    tempLinkSelRef,
    linkDragRef,
    clearEdgeCreationRequest,
    selectEdge,
    setSelectionSource
  ]);
}
