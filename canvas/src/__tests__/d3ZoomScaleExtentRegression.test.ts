import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3WheelZoomScaleExtentDoesNotClampToSchemaOnly() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('mergeScaleExtentWithCurrent')) {
    throw new Error('expected D3 zoom to delegate scale extent widening to SSOT helper')
  }

  const helperPath = resolve(process.cwd(), 'src', 'lib', 'zoom', 'scaleExtent.ts')
  const helper = readFileSync(helperPath, 'utf8')
  if (!helper.includes('Math.max(curMaxK, args.schemaMaxK)')) {
    throw new Error('expected scale extent SSOT helper to widen using current maxK and schema maxK')
  }
  if (!helper.includes('DEFAULT_ZOOM_MAX_SCALE_HARD_CAP') || !helper.includes('DEFAULT_ZOOM_MIN_SCALE_HARD_CAP')) {
    throw new Error('expected scale extent SSOT helper to apply hard caps for safety')
  }
}
