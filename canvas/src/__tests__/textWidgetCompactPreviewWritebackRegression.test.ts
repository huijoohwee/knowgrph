import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testTextWidgetCompactPreviewKeepsRawTextWhileTyping() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const compactPreviewPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'widgetCompactPreview.ts')
  const text = readFileSync(filePath, 'utf8')
  const compactPreviewText = readFileSync(compactPreviewPath, 'utf8')

  if (!compactPreviewText.includes("args.nextText === '' ? undefined : args.nextText")) {
    throw new Error('expected shared compact preview writeback to preserve raw text instead of trimming on every keystroke')
  }
  if (text.includes("nextText.trim() ? nextText : undefined")) {
    throw new Error('expected text widget compact preview writeback to stop trimming live text edits')
  }
  if (!text.includes('const nextProperties = applyWidgetCompactPreviewTextUpdate({')) {
    throw new Error('expected NodeOverlayEditorForm to delegate compact preview text mutation to the shared helper')
  }
  if (!text.includes('return buildWidgetCompactPreviewViewModel({')) {
    throw new Error('expected NodeOverlayEditorForm to delegate compact preview presentation state to the shared view-model helper')
  }
  if (!compactPreviewText.includes('if (!isEditableWidgetCompactPreviewText(args.preview)) return null')) {
    throw new Error('expected shared compact preview writeback to centralize the text-editability guard')
  }
  if (!compactPreviewText.includes("sectionAriaLabel: 'Widget output preview'")) {
    throw new Error('expected shared compact preview view-model helper to own preview section labels')
  }
  if (!text.includes('return resolveWidgetCompactPreview({')) {
    throw new Error('expected NodeOverlayEditorForm to delegate compact preview derivation to the shared helper')
  }
  if (!compactPreviewText.includes('const widgetIdentity = resolveNodeWidgetIdentity({ node: args.node, registryEntry: args.registryEntry })')) {
    throw new Error('expected shared compact preview helper to reuse shared widget identity resolution')
  }
}
