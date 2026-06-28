import { testStoryboardRichMediaDropBrowserSmokeContract } from '@/__tests__/storyboardRichMediaDropBrowserSmokeContract.test'
import { testStoryboardRichMediaDropCentersPanelOnPointer } from '@/__tests__/storyboardPortEdgeIntegration.test'

async function main() {
  testStoryboardRichMediaDropCentersPanelOnPointer()
  testStoryboardRichMediaDropBrowserSmokeContract()
  console.log('OK subsetStoryboardRichMediaDropSmoke')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
