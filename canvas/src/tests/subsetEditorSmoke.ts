import { testMarkdownEditorTextareaHeightAlignsAndSyncScrollsInSplitView } from '@/__tests__/markdownEditorSizingAndSyncScroll.test'

async function main() {
  await testMarkdownEditorTextareaHeightAlignsAndSyncScrollsInSplitView()
  console.log('OK subsetEditorSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

