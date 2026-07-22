import {
  beginSourceFilesDocumentIntent,
  clearSourceFilesDocumentIntent,
  readSourceFilesBootstrapReady,
} from '@/features/source-files/sourceFilesBootstrapReadiness'
import {
  hydrateCanonicalXrMotionReferenceRuntime,
  hydrateCanonicalXrPhysicsRuntime,
} from '@/features/three/XrMotionReferenceRuntimeBridge'
import { readXrMotionReferenceRuntime } from '@/features/three/xrMotionReferenceRuntime'
import { readXrPhysicsRuntime } from '@/features/three/xrPhysicsRuntime'
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
