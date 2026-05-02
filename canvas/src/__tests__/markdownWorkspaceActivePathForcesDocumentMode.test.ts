import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readContentModeEffectsSection(text: string): string {
  const start = text.indexOf("React.useEffect(() => {\n    if (contentMode === 'widget' && !widgetAvailable) setContentModeAuto('document')")
  const end = text.indexOf('  const widgetBundleJsonText = React.useMemo(() => {')
  if (start < 0 || end <= start) return ''
  return text.slice(start, end)
}

export function testMarkdownWorkspaceActiveMarkdownPathForcesDocumentModeEvenWhenWidgetAvailable() {
  const p = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceWidgetMode.ts')
  const text = readFileSync(p, 'utf8')
  const section = readContentModeEffectsSection(text)
  if (!section) {
    throw new Error('expected widget-mode SSOT to keep a distinct content-mode effect section')
  }
  if (section.includes("if (activePath && isMarkdownPath(activePath)) {\n      setContentModeAuto('document')")) {
    throw new Error('expected active markdown path to stop force-resetting widget mode for visible workspace widgets')
  }
  if (!section.includes("if (isMarkdownPathActive) return")) {
    throw new Error('expected active markdown paths to block widget-mode auto-promotion without forcing a document-mode reset')
  }
  if (!section.includes("}, [activePath, contentMode, isMarkdownPath, setContentModeAuto, widgetAvailable])")) {
    throw new Error('expected widget-mode auto-promotion guard to stay scoped by activePath and markdown-path semantics')
  }
}
