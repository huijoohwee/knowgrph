import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootReusesSharedOverlaySizingContractAcrossHooks() {
  const rootPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const rootStoreSelectorPattern = 'overlaySizing: readOverlaySizingInputFromStoreState(s),'
  const d3SceneHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const richMediaHookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useRichMediaOverlays2d.ts')

  const rootText = readFileSync(rootPath, 'utf8')
  const d3SceneHookText = readFileSync(d3SceneHookPath, 'utf8')
  const richMediaHookText = readFileSync(richMediaHookPath, 'utf8')

  if (!rootText.includes('readOverlaySizingInputFromStoreState') || !rootText.includes(rootStoreSelectorPattern)) {
    throw new Error('expected GraphCanvasRootImpl to expose shared overlaySizing directly from the store selector helper')
  }
  if (rootText.includes('const overlaySizing = useMemo<OverlayDensitySizingConfigInput>(() => readOverlaySizingInputFromStoreState({')) {
    throw new Error('expected GraphCanvasRootImpl to stop rebuilding overlaySizing locally once the store snapshot exposes the shared contract')
  }
  if (!rootText.includes('overlaySizing,')) {
    throw new Error('expected GraphCanvasRootImpl to pass the shared overlay sizing contract into downstream GraphCanvasRoot hooks')
  }
  if (!d3SceneHookText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected useD3GraphScene2d to accept the shared overlay sizing contract instead of six raw sizing props')
  }
  if (!richMediaHookText.includes('overlaySizing?: OverlayDensitySizingConfigInput | null')) {
    throw new Error('expected useRichMediaOverlays2d to accept the shared overlay sizing contract instead of six raw sizing props')
  }
  if (!richMediaHookText.includes('sizing: overlaySizing || null,')) {
    throw new Error('expected useRichMediaOverlays2d to normalize overlay sizing from the shared contract')
  }
}
