import { applyGroupResizeDragSensitivity } from '@/lib/canvas/groupResizeHandleConfig'

export const testGroupResizeDragSensitivityAppliesDeadzoneAndDamping = () => {
  const start = { x: 10, y: 20 }
  const tiny = applyGroupResizeDragSensitivity({
    startWorld: start,
    world: { x: 10.8, y: 20.6 },
    zoomK: 1,
    dragSensitivity: 0.72,
    dragDeadzonePx: 3,
  })
  if (tiny.x !== start.x || tiny.y !== start.y) throw new Error('expected tiny move to be ignored by deadzone')

  const moved = applyGroupResizeDragSensitivity({
    startWorld: start,
    world: { x: 30, y: 40 },
    zoomK: 1,
    dragSensitivity: 0.5,
    dragDeadzonePx: 2,
  })
  if (!(moved.x > start.x && moved.y > start.y)) throw new Error('expected adjusted world to move')
  if (!(moved.x < 30 && moved.y < 40)) throw new Error('expected sensitivity to damp movement')
}

