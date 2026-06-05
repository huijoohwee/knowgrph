import { testGraphCenteredSvgPutsCentroidInViewCenter, testGraphCenteredSvgIncludesAnimationWhenEnabled } from '@/__tests__/graphCenteredSvg.test'

async function main() {
  testGraphCenteredSvgPutsCentroidInViewCenter()
  testGraphCenteredSvgIncludesAnimationWhenEnabled()
  console.log('OK verify-export-centeredSvg')
}

main()

