import {
  beginSourceFilesDocumentIntent,
  clearSourceFilesDocumentIntent,
  readSourceFilesBootstrapReady,
} from '@/features/source-files/sourceFilesBootstrapReadiness'
import {
  hydrateCanonicalXrMotionReferenceRuntime,
  hydrateCanonicalXrPhysicsRuntime,
} from '@/features/three/XrMotionReferenceRuntimeBridge'
import { inspectLocalAnimation } from '@/features/three/xrAnimationMcpRuntime'
import { readXrMotionReferenceRuntime } from '@/features/three/xrMotionReferenceRuntime'
import { readXrPhysicsRuntime } from '@/features/three/xrPhysicsRuntime'
import { inspectLocalXrSceneAssets } from '@/features/three/xrSceneMcpRuntime'
import { controlLocalCamera } from '@/features/strybldr/cameraMcpRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'

export function testXrImperativeHydratorsRespectSourceAuthority(): void {
  const previous = useGraphStore.getState()
  const documentIntentKey = 'test:resolving-document-source'
  useGraphStore.setState({
    graphData: { type: 'Graph', nodes: [], edges: [], metadata: {} },
    markdownDocumentName: 'imperative-authority.md',
    markdownDocumentText: '# Imperative authority',
  } as never)

  try {
    if (!hydrateCanonicalXrMotionReferenceRuntime() || !hydrateCanonicalXrPhysicsRuntime()) {
      throw new Error('settled unit harness source authority must admit canonical XR hydration')
    }
    const motionRevision = readXrMotionReferenceRuntime().revision
    const physicsRevision = readXrPhysicsRuntime().revision

    beginSourceFilesDocumentIntent(documentIntentKey)
    if (readSourceFilesBootstrapReady()) throw new Error('resolving document intent must close source authority')
    if (hydrateCanonicalXrMotionReferenceRuntime() || hydrateCanonicalXrPhysicsRuntime()) {
      throw new Error('imperative XR hydrators must refuse unresolved source authority')
    }
    if (
      readXrMotionReferenceRuntime().revision !== motionRevision
      || readXrPhysicsRuntime().revision !== physicsRevision
    ) {
      throw new Error('refused imperative hydration must not mutate either XR runtime')
    }
    const metadataBeforeCameraControls = JSON.stringify(useGraphStore.getState().graphData?.metadata || {})
    const rejectedCameraControls = [
      controlLocalCamera({ action: 'animate', targetId: 'camera', timeSeconds: 1 }),
      controlLocalCamera({ action: 'scrub', targetId: 'camera', timeSeconds: 1 }),
      controlLocalCamera({ action: 'playback', targetId: 'camera', playing: true }),
    ]
    if (rejectedCameraControls.some(result => result.ok)) {
      throw new Error('Camera choreography must fail closed while document source authority is unresolved')
    }
    if (readXrMotionReferenceRuntime().revision !== motionRevision) {
      throw new Error('rejected Camera choreography must not mutate the XR motion runtime')
    }
    if (JSON.stringify(useGraphStore.getState().graphData?.metadata || {}) !== metadataBeforeCameraControls) {
      throw new Error('rejected Camera choreography must not persist graph metadata')
    }
    if (inspectLocalXrSceneAssets().sceneReady || inspectLocalAnimation().sceneReady) {
      throw new Error('XR scene and Animation MCP inspection must report unresolved source authority as not ready')
    }
  } finally {
    clearSourceFilesDocumentIntent(documentIntentKey)
    useGraphStore.setState({
      graphData: previous.graphData,
      markdownDocumentName: previous.markdownDocumentName,
      markdownDocumentText: previous.markdownDocumentText,
    } as never)
    hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
  }
}
