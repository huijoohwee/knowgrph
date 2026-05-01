import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPersistPrevLayoutSnapshotHelperIsReusedByD3SceneHook() {
  const hookPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const helperPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'persistPrevLayoutSnapshot.ts')
  const hookText = readFileSync(hookPath, 'utf8')
  const helperText = readFileSync(helperPath, 'utf8')

  if (!helperText.includes('export function persistPrevLayoutSnapshot')) {
    throw new Error('expected shared previous-layout snapshot persistence helper to be defined upstream')
  }
  if (!helperText.includes('const key = buildLayoutPositionCacheKey({')) {
    throw new Error('expected previous-layout snapshot helper to centralize layout cache key derivation')
  }
  if (!helperText.includes('args.setLayoutPositionsForMode(key, args.prevPositions)')) {
    throw new Error('expected previous-layout snapshot helper to centralize layout snapshot persistence')
  }
  if (!hookText.includes("import { persistPrevLayoutSnapshot } from '@/components/GraphCanvasRoot/utils/persistPrevLayoutSnapshot'")) {
    throw new Error('expected useD3GraphScene2d to reuse the shared previous-layout snapshot persistence helper')
  }
  if (!hookText.includes('persistPrevLayoutSnapshot({')) {
    throw new Error('expected useD3GraphScene2d to delegate previous-layout snapshot persistence to the shared helper')
  }
}
