import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayCollisionStaysStableAcrossZoomInteractionFrames() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(runtimePath, 'utf8')
  if (text.includes('pinnedToNodeByIdRef') || text.includes('anyEditorPinnedToNode')) {
    throw new Error('expected overlay collision runtime to avoid legacy pinned editor tracking state')
  }
  if (text.includes('overlayCollisionZoomDebounceRef')) {
    throw new Error('expected overlay collision runtime to avoid zoom-debounce-driven collision mutation scheduling')
  }
  if (text.includes('overlayCollisionLastZoomKRef')) {
    throw new Error('expected overlay collision runtime to avoid zoom-k tracking for collision scheduling')
  }
  if (!text.includes('const overlayCollisionResolveRafRef = React.useRef<number | null>(null)')) {
    throw new Error('expected overlay collision runtime to keep an explicit RAF scheduler ref')
  }
  if (text.includes('FLOW_EDITOR_INTERACTION_FRAME_EVENT')) {
    throw new Error('expected overlay collision runtime to avoid zoom interaction-frame listeners')
  }
  if (text.includes('setTimeout(') || text.includes('clearTimeout(')) {
    throw new Error('expected overlay collision runtime to avoid timeout-based zoom mutation scheduling')
  }
  if (!text.includes('scheduleOverlayCollisionResolveRef.current = scheduleOverlayCollisionResolve')) {
    throw new Error('expected overlay collision runtime to keep a stable ref bridge for rescheduling')
  }
  if (!text.includes('canvasWindowOffset.left,') || !text.includes('viewportH,') || !text.includes('viewportW,')) {
    throw new Error('expected overlay collision scheduler effect deps to stay scoped to structural and viewport inputs')
  }
  if (text.includes('attributeFilter')) {
    throw new Error('expected overlay collision runtime to avoid mutation observers for overlay tracking')
  }
}

export function testFlowEditorOverlayCollisionSkipsSelfCommittedStoreChurn() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(p, 'utf8')

  if (!text.includes('const selfCommittedPosSignatureRef = React.useRef<string>(\'\')')) {
    throw new Error('expected overlay collision runtime to keep an explicit self-commit signature guard')
  }
  if (!text.includes('const observedStorePosSignatureRef = React.useRef<string>(\'\')')) {
    throw new Error('expected overlay collision runtime to keep an explicit observed store-signature guard')
  }
  if (!text.includes('selfCommittedPosSignatureRef.current = buildPosSignature(overlayNodeIds, {')) {
    throw new Error('expected overlay collision runtime to stamp self-commit signature before setFlowWidgetPosByNodeId writeback')
  }
  if (!text.includes('posById: nextPos') || !text.includes('worldById: nextWorld')) {
    throw new Error('expected overlay collision runtime to include both floating and pinned positions in self-commit signature')
  }
  if (!text.includes('if (currentSig && currentSig === selfCommittedPosSignatureRef.current) {')) {
    throw new Error('expected overlay collision subscription to ignore immediate self-committed flowWidgetPos updates')
  }
  if (!text.includes('if (currentSig && currentSig === observedStorePosSignatureRef.current) {')) {
    throw new Error('expected overlay collision subscription to ignore unrelated store churn that does not change the active graph-scoped signature')
  }
  if (!text.includes('selfCommittedPosSignatureRef.current = \'\'')) {
    throw new Error('expected overlay collision self-commit guard to clear consumed signatures')
  }
  if (!text.includes('observedStorePosSignatureRef.current = currentSig')) {
    throw new Error('expected overlay collision runtime to memoize the last observed graph-scoped signature before rescheduling')
  }
  if (text.includes('panelScaleKey') || text.includes('pinSig')) {
    throw new Error('expected overlay collision settle keys to ignore zoom-scale and pin-state changes')
  }
  if (text.includes('const unsubWorld = useGraphStore.subscribe') || text.includes('const unsubWorldByKey = useGraphStore.subscribe')) {
    throw new Error('expected overlay collision subscriptions to ignore zoom-maintained world-position writes')
  }
  if (text.includes('const unsubPinned = useGraphStore.subscribe') || text.includes('const unsubPinnedByKey = useGraphStore.subscribe')) {
    throw new Error('expected overlay collision subscriptions to ignore pin/unpin authority changes')
  }
  if (!text.includes('st.openWidgetNodeIdsByRenderer?.flowEditor')) {
    throw new Error('expected overlay collision warmup and open-widget watcher to prefer Flow Editor renderer-scoped widget ids')
  }
  if (!text.includes('Array.isArray(s.openWidgetNodeIdsByRenderer?.flowEditor)')) {
    throw new Error('expected overlay collision open-widget subscription to read renderer-scoped Flow Editor ids before any global fallback')
  }
}
