import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasMediaOverlayPathReusesSharedOverlaySizingContract() {
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowStoreStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasStoreState.ts')
  const flowLayoutPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts')
  const mediaOverlayPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')

  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const flowStoreStateText = readFileSync(flowStoreStatePath, 'utf8')
  const flowLayoutText = readFileSync(flowLayoutPath, 'utf8')
  const mediaOverlayText = readFileSync(mediaOverlayPath, 'utf8')

  if (!flowStoreStateText.includes('overlaySizing: readOverlaySizingInputFromStoreState(s),')) {
    throw new Error('expected useFlowCanvasStoreState to expose shared overlaySizing directly from the store selector helper')
  }
  if (!flowCanvasText.includes('overlaySizing,') || flowCanvasText.includes('const overlaySizing = React.useMemo(')) {
    throw new Error('expected FlowCanvas to consume shared overlaySizing from the store snapshot instead of rebuilding it locally')
  }
  if (!flowCanvasText.includes('overlaySizing,') || !flowCanvasText.includes('overlaySizing={overlaySizing}')) {
    throw new Error('expected FlowCanvas to thread the shared overlaySizing contract into both layout state and media overlays')
  }
  if (!flowLayoutText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected useFlowCanvasLayoutState to accept the shared overlay sizing contract instead of legacy three-iframe sizing fields')
  }
  if (!flowLayoutText.includes('sizing: overlaySizing || null,')) {
    throw new Error('expected useFlowCanvasLayoutState to normalize fit sizing from the shared overlaySizing contract')
  }
  if (!mediaOverlayText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected FlowCanvasMediaOverlays to accept the shared overlay sizing contract instead of legacy three-iframe sizing fields')
  }
  if (!mediaOverlayText.includes("const sizingConfig = readOverlaySizingConfigForDensity({ density, sizing: overlaySizing || null })")) {
    throw new Error('expected FlowCanvasMediaOverlays to normalize overlay sizing from the shared contract')
  }
}
