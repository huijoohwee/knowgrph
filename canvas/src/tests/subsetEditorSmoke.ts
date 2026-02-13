import { testMarkdownEditorTextareaHeightAlignsAndSyncScrollsInSplitView } from '@/__tests__/markdownEditorSizingAndSyncScroll.test'
import { testMarkdownWorkspaceToolbarRendersSaveControls } from '@/__tests__/markdownWorkspaceToolbarSaveControls.test'

async function main() {
  await testMarkdownEditorTextareaHeightAlignsAndSyncScrollsInSplitView()
  await testMarkdownWorkspaceToolbarRendersSaveControls()
  console.log('OK subsetEditorSmoke')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
