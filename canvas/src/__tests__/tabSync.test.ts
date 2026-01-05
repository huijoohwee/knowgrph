import { buildEnvelope, type SelectionPayload } from '@/lib/tabSync';

export const testBuildEnvelope = () => {
  const env = buildEnvelope<SelectionPayload>('SelectionChanged', 'g1', 't1', {
    selectedNodeId: 'n1',
    selectedEdgeId: null,
  });
  if (env.kind !== 'SelectionChanged') throw new Error('kind mismatch');
  if (env.graphId !== 'g1') throw new Error('graphId mismatch');
  if (env.sourceTabId !== 't1') throw new Error('tabId mismatch');
  if (!env.timestamp) throw new Error('timestamp missing');
  if (env.payload.selectedNodeId !== 'n1') throw new Error('payload mismatch');
};
