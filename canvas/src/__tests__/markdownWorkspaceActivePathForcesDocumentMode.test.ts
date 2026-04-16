import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readContentModeEffectsSection(text: string): string {
  const start = text.indexOf("React.useEffect(() => {\n    if (contentMode !== 'nodeQuickEditor') return")
  const end = text.indexOf('  const quickEditorBundleJsonText = React.useMemo(() => {')
  if (start < 0 || end <= start) return ''
  return text.slice(start, end)
}

export function testMarkdownWorkspaceActiveMarkdownPathForcesDocumentModeEvenWhenQuickEditorAvailable() {
  const p = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'MarkdownWorkspaceRuntime.impl.tsx')
  const text = readFileSync(p, 'utf8')
  const section = readContentModeEffectsSection(text)
  if (!section) {
    throw new Error('expected markdown workspace runtime to keep a distinct content-mode effect section')
  }
  if (!section.includes("if (activePath && isMarkdownPath(activePath)) {\n      setContentModeAuto('document')")) {
    throw new Error('expected active markdown path to force document mode even when node quick editor remains available')
  }
  if (!section.includes("}, [activePath, contentMode, nodeQuickEditorAvailable, setContentModeAuto])")) {
    throw new Error('expected nodeQuickEditor->document fallback effect deps to include activePath')
  }
}
