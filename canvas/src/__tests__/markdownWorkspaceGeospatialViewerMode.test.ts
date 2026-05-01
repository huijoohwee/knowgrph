import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testMarkdownWorkspaceGeospatialViewerModeStaysSingleActiveLayout = () => {
  const mainPath = path.resolve(
    process.cwd(),
    'src',
    'components',
    'BottomPanel',
    'markdownWorkspace',
    'main',
    'MarkdownWorkspaceMain.tsx',
  )
  const text = readUtf8(mainPath)
  if (!text.includes("if (prev === 'geospatial') return prev")) {
    throw new Error("Expected workspace editor-mode sync to preserve active geospatial viewer mode as single selected layout")
  }
  if (!text.includes("if (next === 'geospatial')")) {
    throw new Error("Expected markdown workspace viewer-mode handler to branch geospatial mode explicitly")
  }
  if (!text.includes("workspaceTablePreferencesStore.setWorkspaceEditorMode('multiDimTable')")) {
    throw new Error("Expected geospatial mode selection to keep shared workspace editor-mode SSOT synchronized to multiDimTable")
  }
}
