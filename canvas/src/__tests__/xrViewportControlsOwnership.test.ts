import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import {
  xrViewportDragTerminationMatchesPointer,
} from '@/features/three/xrViewportControlsOwnership'
import { setXrMotionReferenceViewportControlActive } from '@/features/three/xrMotionReferenceRuntime'
import {
  bindThreeViewportControlsOwnership,
  canStartThreeObjectDrag,
  claimThreeObjectInputOwnership,
  hasThreeObjectDragMoved,
  readThreeObjectInputOwnership,
  releaseThreeObjectInputOwnership,
} from '@/features/three/threeObjectInputOwnership'

function assertCondition(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

type PointerEventWindow = {
  MouseEvent: typeof MouseEvent
}

function dispatchPointer(
  target: EventTarget,
  window: PointerEventWindow,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  args: { x: number; y: number; buttons: number },
): void {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: args.buttons,
    clientX: args.x,
    clientY: args.y,
  })
  Object.defineProperties(event, {
    pointerId: { configurable: true, value: 1 },
    pointerType: { configurable: true, value: 'mouse' },
    pageX: { configurable: true, value: args.x },
    pageY: { configurable: true, value: args.y },
  })
  target.dispatchEvent(event)
}

export function testXrViewportControlsOwnershipPublishesSynchronously() {
  setXrMotionReferenceViewportControlActive(false)
  const controls = { enabled: true }
  const unsubscribe = bindThreeViewportControlsOwnership({ controls, baseEnabled: true })
  try {
    setXrMotionReferenceViewportControlActive(true)
    assertCondition(!controls.enabled, 'expected XR object ownership to disable viewport controls before the setter returns')
    setXrMotionReferenceViewportControlActive(false)
    assertCondition(controls.enabled, 'expected releasing XR object ownership to restore available viewport controls')
    unsubscribe()
    setXrMotionReferenceViewportControlActive(true)
    assertCondition(controls.enabled, 'expected disposal to detach the viewport ownership subscriber')
  } finally {
    setXrMotionReferenceViewportControlActive(false)
    unsubscribe()
  }

  const externallyDisabledControls = { enabled: true }
  const releaseExternalOwner = bindThreeViewportControlsOwnership({
    controls: externallyDisabledControls,
    baseEnabled: false,
  })
  try {
    setXrMotionReferenceViewportControlActive(true)
    setXrMotionReferenceViewportControlActive(false)
    assertCondition(!externallyDisabledControls.enabled, 'expected drag release to preserve another camera owner')
  } finally {
    releaseExternalOwner()
    setXrMotionReferenceViewportControlActive(false)
  }
}

export function testThreeObjectInputOwnershipPublishesSynchronously() {
  releaseThreeObjectInputOwnership('node-a')
  const controls = { enabled: true }
  const unsubscribe = bindThreeViewportControlsOwnership({ controls, baseEnabled: true })
  try {
    assertCondition(canStartThreeObjectDrag(0), 'expected primary pointer drag without a keyboard modifier')
    assertCondition(!canStartThreeObjectDrag(1) && !canStartThreeObjectDrag(2), 'expected auxiliary pointers to remain camera inputs')
    assertCondition(!hasThreeObjectDragMoved({ x: 10, y: 10 }, { x: 12, y: 11 }), 'expected click jitter to remain selection-only')
    assertCondition(hasThreeObjectDragMoved({ x: 10, y: 10 }, { x: 14, y: 10 }), 'expected deliberate pointer motion to start object movement')
    assertCondition(claimThreeObjectInputOwnership('node-a', 7), 'expected the first pointer to claim object input')
    assertCondition(!controls.enabled, 'expected node pointerdown to synchronously disable viewport controls')
    assertCondition(readThreeObjectInputOwnership().nodeId === 'node-a', 'expected ownership to identify the dragged node')
    assertCondition(!claimThreeObjectInputOwnership('node-b', 8), 'expected a second pointer to be unable to steal object input')
    releaseThreeObjectInputOwnership('node-a', 8)
    assertCondition(!controls.enabled, 'expected a second pointer to preserve the active object owner')
    releaseThreeObjectInputOwnership('node-a', 7)
    assertCondition(controls.enabled, 'expected the owning pointer to restore viewport controls')
  } finally {
    releaseThreeObjectInputOwnership('node-a')
    unsubscribe()
  }
}

export function testXrViewportDragTerminationHonorsPointerOwnership() {
  assertCondition(
    xrViewportDragTerminationMatchesPointer({ pointerId: 7 }, 7),
    'expected the active pointer to finish its XR object drag',
  )
  assertCondition(
    !xrViewportDragTerminationMatchesPointer({ pointerId: 8 }, 7),
    'expected a second pointer to leave the active XR object drag owned',
  )
  assertCondition(
    xrViewportDragTerminationMatchesPointer({}, 7),
    'expected non-pointer cancellation such as blur or hidden visibility to finish the XR object drag',
  )
}

export function testThreeObjectDragSuppressesOrbitControlsBeforePointerMove() {
  const { dom, restore } = initJsdomHarness()
  const canvas = dom.window.document.createElement('canvas')
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 800 },
    clientHeight: { configurable: true, value: 600 },
    setPointerCapture: { configurable: true, value: () => undefined },
    releasePointerCapture: { configurable: true, value: () => undefined },
  })
  dom.window.document.body.appendChild(canvas)
  const camera = new PerspectiveCamera(50, 4 / 3, 0.1, 1000)
  camera.position.set(0, 0, 10)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.target.set(0, 0, 0)
  controls.update()
  setXrMotionReferenceViewportControlActive(false)

  const resetPose = () => {
    camera.position.set(0, 0, 10)
    controls.target.set(0, 0, 0)
    controls.update()
  }
  const drag = () => {
    dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointerdown', { x: 400, y: 300, buttons: 1 })
    dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointermove', { x: 560, y: 390, buttons: 1 })
    dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointerup', { x: 560, y: 390, buttons: 0 })
  }

  try {
    const initialPosition = camera.position.clone()
    drag()
    assertCondition(camera.position.distanceTo(initialPosition) > 1, 'expected the OrbitControls harness to rotate when no object owns the drag')
    resetPose()

    const releaseOwnership = bindThreeViewportControlsOwnership({ controls, baseEnabled: true })
    const claimObjectDrag = () => claimThreeObjectInputOwnership('node-a', 1)
    const releaseObjectDrag = () => releaseThreeObjectInputOwnership('node-a', 1)
    canvas.addEventListener('pointerdown', claimObjectDrag)
    canvas.addEventListener('pointerup', releaseObjectDrag)
    canvas.addEventListener('pointercancel', releaseObjectDrag)
    canvas.addEventListener('lostpointercapture', releaseObjectDrag)
    try {
      const expectedPosition = camera.position.clone()
      const expectedQuaternion = camera.quaternion.clone()
      const expectedTarget = controls.target.clone()
      dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointerdown', { x: 400, y: 300, buttons: 1 })
      assertCondition(!controls.enabled, 'expected the object pointerdown to synchronously claim camera controls')
      dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointermove', { x: 560, y: 390, buttons: 1 })
      canvas.dispatchEvent(new dom.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 240 }))
      dispatchPointer(canvas, dom.window as unknown as PointerEventWindow, 'pointerup', { x: 560, y: 390, buttons: 0 })
      controls.update()
      assertCondition(camera.position.equals(expectedPosition), 'expected object dragging to preserve the camera position')
      assertCondition(camera.quaternion.equals(expectedQuaternion), 'expected object dragging to preserve the camera orientation')
      assertCondition(controls.target.equals(expectedTarget), 'expected object dragging to preserve the OrbitControls target')
      assertCondition(controls.enabled, 'expected pointerup to restore camera controls')
    } finally {
      canvas.removeEventListener('pointerdown', claimObjectDrag)
      canvas.removeEventListener('pointerup', releaseObjectDrag)
      canvas.removeEventListener('pointercancel', releaseObjectDrag)
      canvas.removeEventListener('lostpointercapture', releaseObjectDrag)
      releaseOwnership()
    }
  } finally {
    releaseThreeObjectInputOwnership('node-a')
    setXrMotionReferenceViewportControlActive(false)
    controls.dispose()
    restore()
  }
}
