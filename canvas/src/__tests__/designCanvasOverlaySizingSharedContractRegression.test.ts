import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignCanvasReusesSharedOverlaySizingContractAcrossBootstrapAndRuntime() {
  const designCanvasPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const bootstrapPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasBootstrap.ts')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasOverlayRuntime.ts')

  const designCanvasText = readFileSync(designCanvasPath, 'utf8')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')
  const runtimeText = readFileSync(runtimePath, 'utf8')

  if (!bootstrapText.includes('overlaySizing: readOverlaySizingInputFromStoreState(state),')) {
    throw new Error('expected useDesignCanvasBootstrap to expose shared overlaySizing directly from the store snapshot')
  }
  if (!designCanvasText.includes('overlaySizing: snapshot.overlaySizing,')) {
    throw new Error('expected DesignCanvas to pass shared overlaySizing from the bootstrap snapshot into the overlay runtime')
  }
  if (!runtimeText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected useDesignCanvasOverlayRuntime to accept the shared overlay sizing contract instead of legacy three-iframe sizing fields')
  }
  if (!runtimeText.includes('const sizingConfig = readOverlaySizingConfigForDensity({ density, sizing: overlaySizing || null })')) {
    throw new Error('expected useDesignCanvasOverlayRuntime to normalize overlay sizing from the shared contract')
  }
}
