import { testStoryboardRichMediaDropBrowserSmokeContract } from '@/__tests__/storyboardRichMediaDropBrowserSmokeContract.test'
import { testStoryboardRichMediaDropCentersPanelOnPointer } from '@/__tests__/storyboardPortEdgeIntegration.test'
import { testStoryboardOverlayEdgesRetainNewerStableRevision } from '@/__tests__/storyboardOverlayEdgeStaleGraphRetention.test'

async function main() {
testStoryboardRichMediaDropCentersPanelOnPointer()
testStoryboardOverlayEdgesRetainNewerStableRevision()
  testStoryboardRichMediaDropBrowserSmokeContract()
  console.log('OK subsetStoryboardRichMediaDropSmoke')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
