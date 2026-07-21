import assert from 'node:assert/strict'
import test from 'node:test'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  resetGameFpsRuntimeForTests,
} from '@/features/game-fps/gameFpsRuntime'
import {
  resetGameModeRuntimeForTests,
} from '@/features/game-fps/gameModeRuntime'
import { resetGameFpsDecisionStoreForTests } from '@/features/game-fps/gameFpsDecisionStore'
import {
  hydrateCanonicalXrMotionReferenceRuntime,
  hydrateCanonicalXrPhysicsRuntime,
} from '@/features/three/XrMotionReferenceRuntimeBridge'
import { XR_MOTION_REFERENCE_GRAPH_METADATA_KEY } from '@/features/three/xrMotionReferenceModel'

type RestorableGraphState = Readonly<Pick<
  ReturnType<typeof useGraphStore.getState>,
  | 'canvasRenderMode'
  | 'canvasRenderModeIsAuto'
  | 'canvasRenderModeLastFree'
  | 'canvas3dMode'
  | 'floatingPanelOpen'
  | 'floatingPanelView'
  | 'graphData'
  | 'markdownDocumentName'
  | 'markdownDocumentText'
  | 'schema'
  | 'timelineTransportPlaying'
>>

let fixtureSequence = 0

function captureRestorableGraphState(): RestorableGraphState {
  const state = useGraphStore.getState()
  return Object.freeze({
    canvasRenderMode: state.canvasRenderMode,
    canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
    canvasRenderModeLastFree: state.canvasRenderModeLastFree,
    canvas3dMode: state.canvas3dMode,
    floatingPanelOpen: state.floatingPanelOpen,
    floatingPanelView: state.floatingPanelView,
    graphData: state.graphData,
    markdownDocumentName: state.markdownDocumentName,
    markdownDocumentText: state.markdownDocumentText,
    schema: state.schema,
    timelineTransportPlaying: state.timelineTransportPlaying,
  })
}

export function installGameModeRuntimeTestLifecycle(fileLabel: string): void {
  let graphStateBeforeTest: RestorableGraphState | null = null

  test.beforeEach(() => {
    graphStateBeforeTest = captureRestorableGraphState()
    fixtureSequence += 1
    useGraphStore.setState({
      canvasRenderMode: '2d',
      canvas3dMode: '3d',
      floatingPanelOpen: false,
      floatingPanelView: 'motionControl',
      graphData: {
        type: 'Graph',
        nodes: [],
        edges: [],
        metadata: {
          [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: { stageId: 'singapore' },
        },
      },
      markdownDocumentName: `${fileLabel}-${fixtureSequence}.md`,
      markdownDocumentText: '# Canonical Game Mode test scene',
      timelineTransportPlaying: false,
    } as never)
    assert.equal(hydrateCanonicalXrMotionReferenceRuntime(), true)
    hydrateCanonicalXrPhysicsRuntime()
    resetGameFpsDecisionStoreForTests()
    resetGameModeRuntimeForTests()
    resetGameFpsRuntimeForTests()
  })

  test.afterEach(() => {
    resetGameModeRuntimeForTests()
    resetGameFpsRuntimeForTests()
    resetGameFpsDecisionStoreForTests()
    const previous = graphStateBeforeTest
    graphStateBeforeTest = null
    if (!previous) return
    useGraphStore.setState(previous as never)
    hydrateCanonicalXrMotionReferenceRuntime()
    hydrateCanonicalXrPhysicsRuntime()
  })
}
