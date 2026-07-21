import {
  testGameFpsBrowserSmokeContractIsLocalAndInteractive,
  testGameFpsDecisionStoreUsesBrowserSafeCanonicalMerge,
  testGameFpsRepoLocalActiveSourceSkipsDocsMirrorFetch,
  testGameFpsRunReadyRegistryUsesCanonicalSourceDocument,
  testGameFpsRunReadySurfaceReusesSingleThreeCanvas,
} from '@/__tests__/gameFpsRunReadyContract.test'
import { gameFpsInputPatchFromPressedCodes } from '@/features/game-fps/gameFpsInput'

function testGameFpsKeyboardInputIsNormalizedAndComposable() {
  const diagonal = gameFpsInputPatchFromPressedCodes(new Set(['KeyW', 'KeyD', 'ShiftLeft']))
  if (diagonal.forward !== 1 || diagonal.strafe !== 1 || diagonal.sprint !== true) {
    throw new Error(`unexpected diagonal FPS input ${JSON.stringify(diagonal)}`)
  }
  const neutral = gameFpsInputPatchFromPressedCodes(new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD']))
  if (neutral.forward !== 0 || neutral.strafe !== 0) {
    throw new Error(`opposing FPS input must cancel ${JSON.stringify(neutral)}`)
  }
}

async function main() {
  testGameFpsRunReadyRegistryUsesCanonicalSourceDocument()
  testGameFpsRunReadySurfaceReusesSingleThreeCanvas()
  testGameFpsBrowserSmokeContractIsLocalAndInteractive()
  testGameFpsDecisionStoreUsesBrowserSafeCanonicalMerge()
  await testGameFpsRepoLocalActiveSourceSkipsDocsMirrorFetch()
  testGameFpsKeyboardInputIsNormalizedAndComposable()
  console.log('OK subsetGameFpsSmoke')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
