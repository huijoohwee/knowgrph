import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { GraphData } from '@/lib/graph/types'
import {
  registerAgenticOsRemoteGrammarCatalogEntries,
  resetAgenticOsRemoteGrammarCatalogForTests,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import {
  buildCameraKeyboardInvocation,
  controlLocalCamera,
  inspectLocalCamera,
} from '@/features/strybldr/cameraMcpRuntime'
import {
  publishCameraFramingRuntime,
  readCameraFramingRuntime,
} from '@/features/strybldr/cameraFramingRuntime'
import {
  THREE_CAMERA_KEYBOARD_FINE_ORBIT_STEP,
  THREE_CAMERA_KEYBOARD_ORBIT_STEP,
  resolveThreeCameraKeyboardFraming,
  resolveThreeKeyboardCommandAmount,
  resolveThreeKeyboardMotionDirection,
} from '@/features/three/threeKeyboardChoreography'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  readXrMotionReferencePlan,
  serializeXrMotionReferencePlan,
} from '@/features/three/xrMotionReferenceModel'
import {
  readXrMotionReferenceRuntime,
  selectXrMotionReferenceCameraMark,
} from '@/features/three/xrMotionReferenceRuntime'
import { hydrateCanonicalXrMotionReferenceRuntime } from '@/features/three/XrMotionReferenceRuntimeBridge'
import { useGraphStore } from '@/hooks/useGraphStore'

const CAMERA_DICTIONARY_TOKENS = {
  command: ['/camera.frame', '/camera.animate', '/camera.play', '/camera.scrub'],
  semantic: ['#camera-shot', '#camera-motion'],
  binding: ['@camera', '@selected-actor'],
} as const

function registerCanonicalCameraGrammar(): void {
  resetAgenticOsRemoteGrammarCatalogForTests()
  for (const [kind, tokens] of Object.entries(CAMERA_DICTIONARY_TOKENS)) {
    const fileName = kind === 'command'
      ? 'DICTIONARY-COMMAND.md'
      : kind === 'semantic'
        ? 'DICTIONARY-SEMANTIC.md'
        : 'DICTIONARY-BINDING.md'
    const source = readFileSync(resolve(process.cwd(), '..', '..', 'agentic-canvas-os', 'docs', fileName), 'utf8')
    for (const token of tokens) {
      if (!source.includes(`  - "${token}"`) || !source.includes(`| \`${token}\` |`)) {
        throw new Error(`expected upstream ${fileName} to own ${token}`)
      }
    }
    registerAgenticOsRemoteGrammarCatalogEntries(tokens.map(token => ({ token, kind, sourcePath: fileName })))
  }
}

function buildKeyboardCameraGraph(): GraphData {
  const nodes = [{ id: 'actor-a', label: 'Lead', type: 'Person', properties: {} }]
  const plan = readXrMotionReferencePlan({
    durationSeconds: 6,
    camera: [{
      timeSeconds: 1,
      anchorId: 'actor-a',
      settings: { angle: 'front', level: 'eye-level', shot: 'medium', note: '', orbitX: 0, orbitY: 0, focalLengthMm: 50 },
    }],
  }, nodes)
  return {
    type: 'Graph',
    nodes,
    edges: [],
    metadata: { [XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]: serializeXrMotionReferencePlan(plan) },
  }
}

export function testXrKeyboardChoreographySharesBrowserAndMcpMotion(): void {
  registerCanonicalCameraGrammar()
  const diagonal = resolveThreeKeyboardMotionDirection(['w', 'd'])
  const cameraSettings = resolveThreeCameraKeyboardFraming({
    amount: THREE_CAMERA_KEYBOARD_ORBIT_STEP,
    keys: ['w', 'd'],
    settings: {},
  })
  if (Math.abs(Number(diagonal?.[0]) - Math.SQRT1_2) > 0.000001
    || Math.abs(Number(diagonal?.[1]) + Math.SQRT1_2) > 0.000001
    || resolveThreeKeyboardMotionDirection(['a', 'd']) !== null
    || resolveThreeKeyboardCommandAmount({ fine: false, target: 'camera' }) !== THREE_CAMERA_KEYBOARD_ORBIT_STEP
    || resolveThreeKeyboardCommandAmount({ fine: true, target: 'camera' }) !== THREE_CAMERA_KEYBOARD_FINE_ORBIT_STEP
    || resolveThreeKeyboardCommandAmount({ amount: 2.01, fine: false, target: 'camera' }) !== null
    || !cameraSettings
    || Math.abs(cameraSettings.orbitX - THREE_CAMERA_KEYBOARD_ORBIT_STEP * Math.SQRT1_2) > 0.000001
    || Math.abs(cameraSettings.orbitY + THREE_CAMERA_KEYBOARD_ORBIT_STEP * Math.SQRT1_2) > 0.000001) {
    throw new Error('expected one normalized keyboard resolver to own Camera and object motion profiles')
  }

  const invocation = buildCameraKeyboardInvocation({ action: 'frame', keys: ['w', 'd'], amount: 0.08 })
  if (invocation !== '/camera.frame @camera #camera-shot keys=w+d amount=0.08') {
    throw new Error(`expected a canonical source-backed keyboard invocation, got ${invocation}`)
  }

  const graphData = buildKeyboardCameraGraph()
  useGraphStore.setState({
    markdownDocumentName: 'Keyboard camera.md',
    markdownDocumentText: '# Keyboard camera',
    graphData,
    selectedNodeId: 'actor-a',
    canvasRenderMode: '3d',
    canvas3dMode: 'xr',
    timelineTransportPlaying: false,
    floatingPanelOpen: false,
    floatingPanelView: 'animation',
  } as never)
  hydrateCanonicalXrMotionReferenceRuntime()
  const cameraMark = readXrMotionReferenceRuntime().plan.camera[0]
  if (!cameraMark) throw new Error('expected a persisted Camera mark fixture')
  selectXrMotionReferenceCameraMark(cameraMark.id)

  publishCameraFramingRuntime({
    anchorId: 'canvas-camera',
    settings: { angle: 'front', level: 'eye-level', shot: 'medium', note: '', orbitX: 0, orbitY: 0, focalLengthMm: 50 },
    source: 'panel',
  })
  const frameResult = controlLocalCamera({ invocation })
  const frame = readCameraFramingRuntime()
  if (!frameResult.ok || frame.settings.orbitX <= 0 || frame.settings.orbitY >= 0) {
    throw new Error(`expected /camera.frame keyboard movement to reuse shared framing, got ${JSON.stringify(frameResult)}`)
  }

  const animateInvocation = buildCameraKeyboardInvocation({
    action: 'animate',
    keys: ['ArrowRight'],
    fine: true,
    markId: cameraMark.id,
  })
  const animateResult = controlLocalCamera({ invocation: animateInvocation })
  const movedMark = readXrMotionReferenceRuntime().plan.camera.find(mark => mark.id === cameraMark.id)
  const persisted = useGraphStore.getState().graphData?.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY]
  const inspection = inspectLocalCamera()
  if (!animateResult.ok
    || movedMark?.settings.orbitX !== THREE_CAMERA_KEYBOARD_FINE_ORBIT_STEP
    || !persisted
    || !inspection.invocationGrammar?.frameKeyboard
    || !inspection.invocationGrammar?.animateKeyboard) {
    throw new Error(`expected /camera.animate keyboard movement to persist the selected Camera mark, got ${JSON.stringify(animateResult)}`)
  }

  useGraphStore.setState({ timelineTransportPlaying: true } as never)
  const playbackOwned = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot keys=d' })
  useGraphStore.setState({ timelineTransportPlaying: false } as never)
  const wrongSemantic = controlLocalCamera({ invocation: '/camera.animate @camera #camera-shot keys=d' })
  const invalidKeys = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot keys=q' })
  const excessiveAmount = controlLocalCamera({ invocation: '/camera.frame @camera #camera-shot keys=d amount=2.01' })
  if (playbackOwned.ok || wrongSemantic.ok || invalidKeys.ok || excessiveAmount.ok) {
    throw new Error('expected keyboard Camera control to reject playback conflicts and malformed source grammar')
  }

  const browserAdapter = readFileSync(resolve(process.cwd(), 'src', 'features', 'three', 'XrKeyboardChoreographyRuntime.tsx'), 'utf8')
  const cameraWebMcp = readFileSync(resolve(process.cwd(), 'src', 'features', 'agent-ready', 'cameraWebMcpTools.ts'), 'utf8')
  if (!browserAdapter.includes('resolveThreeCameraKeyboardFraming')
    || !browserAdapter.includes('resolveThreeObjectKeyboardMotionPosition')
    || !browserAdapter.includes('[data-kg-floating-panel-view-trigger="camera"]')
    || !readFileSync(resolve(process.cwd(), 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'), 'utf8').includes('data-kg-floating-panel-view-trigger={spec.view}')
    || !cameraWebMcp.includes('async input => controlLocalCamera(input || {})')) {
    throw new Error('expected browser keys and WebMCP to delegate to the shared choreography owners')
  }
}
