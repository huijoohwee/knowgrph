
import {
  testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo,
  testMarkdownHeadMetaFrontmatterArrays,
  testMarkdownMediaToggleEndToEnd,
  testMarkdownPresentationFullscreenFromBottomPanelControls
} from '../__tests__/markdownMediaToggleE2e.test'

async function main() {
  console.log('Running markdownMediaToggleE2e tests...')
  
  try {
    console.log('Running testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo...')
    await testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo()
    console.log('PASS testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo')
  } catch (e) {
    console.error('FAIL testMarkdownInlineAbbrAndSpanRenderingFromSlideDemo', e)
    process.exit(1)
  }

  try {
    console.log('Running testMarkdownHeadMetaFrontmatterArrays...')
    await testMarkdownHeadMetaFrontmatterArrays()
    console.log('PASS testMarkdownHeadMetaFrontmatterArrays')
  } catch (e) {
    console.error('FAIL testMarkdownHeadMetaFrontmatterArrays', e)
    process.exit(1)
  }

  try {
    console.log('Running testMarkdownMediaToggleEndToEnd...')
    await testMarkdownMediaToggleEndToEnd()
    console.log('PASS testMarkdownMediaToggleEndToEnd')
  } catch (e) {
    console.error('FAIL testMarkdownMediaToggleEndToEnd', e)
    process.exit(1)
  }

  try {
    console.log('Running testMarkdownPresentationFullscreenFromBottomPanelControls...')
    await testMarkdownPresentationFullscreenFromBottomPanelControls()
    console.log('PASS testMarkdownPresentationFullscreenFromBottomPanelControls')
  } catch (e) {
    console.error('FAIL testMarkdownPresentationFullscreenFromBottomPanelControls', e)
    process.exit(1)
  }

  console.log('All tests passed!')
}

main().catch(e => {
  console.error('Unhandled error', e)
  process.exit(1)
})
