import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testMarkdownWorkspaceAvoidsHardcodedLightThemeClasses = () => {
  const root = process.cwd()
  const toolbarPath = path.resolve(root, 'src', 'components', 'BottomPanel', 'MarkdownWorkspaceToolbar.tsx')
  const explorerPath = path.resolve(root, 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'MarkdownWorkspaceExplorer.tsx')
  const files = [
    toolbarPath,
    explorerPath,
    path.resolve(root, 'src', 'components', 'BottomPanel', 'MarkdownExplorerSection.tsx'),
    path.resolve(root, 'src', 'components', 'BottomPanel', 'MarkdownFileTree.tsx'),
    path.resolve(root, 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'MarkdownWorkspace.tsx'),
    path.resolve(root, 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'MarkdownWorkspaceMain.tsx'),
  ]
  const offenders = ['bg-white', 'bg-zinc-', 'border-zinc-', 'text-zinc-']
  for (const f of files) {
    const text = readUtf8(f)
    for (const bad of offenders) {
      if (text.includes(bad)) {
        throw new Error(`Markdown workspace must not hardcode ${bad} in ${path.basename(f)}`)
      }
    }
  }

  const toolbar = readUtf8(toolbarPath)
  const explorer = readUtf8(explorerPath)
  if (!toolbar.includes('UI_THEME_TOKENS.panel')) throw new Error('Expected toolbar to use UI_THEME_TOKENS.panel tokens')
  if (!explorer.includes('UI_THEME_TOKENS.panel')) throw new Error('Expected explorer to use UI_THEME_TOKENS.panel tokens')
}

export const testMarkdownPreviewViewerForcesPrimaryTextColor = () => {
  const viewerPath = path.resolve(process.cwd(), '..', '..', 'curagrph', 'src', 'features', 'markdown', 'ui', 'MarkdownPreviewViewer.tsx')
  const layoutPath = path.resolve(process.cwd(), '..', '..', 'curagrph', 'src', 'features', 'markdown', 'ui', 'MarkdownPanelLayout.tsx')
  const viewer = readUtf8(viewerPath)
  const layout = readUtf8(layoutPath)
  if (!viewer.includes('UI_THEME_TOKENS.text.primary')) {
    throw new Error('Markdown preview should apply UI_THEME_TOKENS.text.primary to prevent invisible text')
  }
  if (!layout.includes('UI_THEME_TOKENS.text.primary')) {
    throw new Error('Markdown panel layout should apply UI_THEME_TOKENS.text.primary at the frame level')
  }
}

export const testMarkdownWorkspaceToolbarAutoRoutesImageModeWithoutManualSelector = () => {
  const toolbarPath = path.resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'MarkdownWorkspaceToolbar.tsx')
  const toolbar = readUtf8(toolbarPath)
  if (toolbar.includes('Imgs: Auto') || toolbar.includes('Imgs: On') || toolbar.includes('Imgs: Off')) {
    throw new Error('Workspace toolbar should not expose manual image mode selector labels')
  }
  if (!toolbar.includes('Fid: Auto')) {
    throw new Error('Workspace toolbar should keep fidelity auto selector for webpage conversion routing')
  }
}
