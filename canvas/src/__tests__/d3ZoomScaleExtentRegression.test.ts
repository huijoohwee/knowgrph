import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3WheelZoomScaleExtentDoesNotClampToSchemaOnly() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'zoom.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('const nextMaxK = schemaMaxK')) {
    throw new Error('expected D3 wheel zoom scale extent sync to preserve current maxK, not clamp to schemaMaxK only')
  }
  if (!text.includes('Math.max(curMaxK, args.schemaMaxK)')) {
    throw new Error('expected D3 wheel zoom scale extent to widen using current maxK and schema maxK')
  }
  if (!text.includes('DEFAULT_ZOOM_MAX_SCALE_HARD_CAP') || !text.includes('DEFAULT_ZOOM_MIN_SCALE_HARD_CAP')) {
    throw new Error('expected D3 wheel zoom scale extent to apply hard caps for safety')
  }
}

