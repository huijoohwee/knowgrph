import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testWidgetHidesIdentityAndMovesActionsToToolbar = () => {
  const root = process.cwd()
  const panelPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const chromePath = path.resolve(root, 'src', 'components', 'FlowEditor', 'FlowEditorPanelChrome.tsx')
  const formPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const registryPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorRegistrySection.tsx')
  const inlineValuePath = path.resolve(root, 'src', 'components', 'FlowEditor', 'FlowEditorInlineValueEditor.tsx')
  const jsonLikeValuePath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorJsonLikeValueEditor.tsx')
  const fieldMutationPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'widgetFieldMutation.ts')
  const registryTemplatesPath = path.resolve(root, 'src', 'features', 'flow-editor-manager', 'registryTemplates.ts')

  const panel = readUtf8(panelPath)
  const chrome = readUtf8(chromePath)
  if (panel.includes('<p')) {
    throw new Error('Widget panel header must not render <p> elements')
  }
  if (panel.includes('mt-0.5')) {
    throw new Error('Widget header must not render a subtitle line under the title')
  }
  if (!chrome.includes('flowWidgetValidate')) {
    throw new Error('Expected Validate action to live in Widget toolbar')
  }
  if (!chrome.includes('Minimize2') || !chrome.includes('Maximize2')) {
    throw new Error('Expected Minimize/Restore icon buttons in Widget toolbar')
  }
  if (chrome.includes('{active &&')) {
    throw new Error('Expected Widget header icons to remain visible even when View Lock is ON')
  }
  if (!chrome.includes('disabled={!active}')) {
    throw new Error('Expected Widget header icons to disable actions (not hide) when View Lock is ON')
  }

  const form = readUtf8(formPath)
  if (form.includes("rowKey: 'node-type'")) {
    throw new Error('Expected Node Type identity row to be removed from Widget form')
  }
  if (form.includes('flowWidgetValidate')) {
    throw new Error('Expected Validate button to be removed from Widget form body')
  }
  if (form.includes('{entry.widgetTypeId}') || form.includes('{entry.formId}') || form.includes('· {entry.formId}')) {
    throw new Error('Expected Widget Type and Form ID to be hidden from Widget UI labels')
  }
  if (!form.includes('UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME') || !form.includes("'py-0'") || !form.includes("'px-3'")) {
    throw new Error('Expected Widget form to keep zero top/bottom padding while retaining horizontal gutter padding')
  }

  if (form.includes("rowKey: 'smart-")) {
    throw new Error('Expected Smart media KTV rows to be removed from Widget form')
  }
  if (form.includes('flowWidgetSmartFieldsLegend')) {
    throw new Error('Expected Smart media legend label to be removed from Widget form')
  }

  const registry = readUtf8(registryPath)
  const inlineValue = readUtf8(inlineValuePath)
  const jsonLikeValue = readUtf8(jsonLikeValuePath)
  if (!inlineValue.includes("import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'")) {
    throw new Error('Expected Flow Editor editable Value cells to reuse the shared CardInlineTextEditor owner')
  }
  if (inlineValue.includes('stopActivationPropagation={active}')) {
    throw new Error('Expected Flow Editor editable Value cells to keep first-click editing local instead of bubbling into workspace/indexing activation')
  }
  if (!inlineValue.includes('canEdit')) {
    throw new Error('Expected Flow Editor editable Value cells to allow first-click editing through the shared inline editor')
  }
  if (form.includes('if (!active || !fieldSchemaPath) return')) {
    throw new Error('Expected frontmatter Flow Envelope Value commits to accept the first inactive inline edit')
  }
  if (jsonLikeValue.includes('if (!props.active) return')) {
    throw new Error('Expected JSON-like Flow Editor Value commits to accept the first inactive inline edit')
  }
  if (!form.includes("import { FlowEditorInlineValueEditor } from '@/components/FlowEditor/FlowEditorInlineValueEditor'")) {
    throw new Error('Expected frontmatter Flow Envelope Value cells to route through the shared inline Value adapter')
  }
  if (!registry.includes("import { FlowEditorInlineValueEditor } from '@/components/FlowEditor/FlowEditorInlineValueEditor'")) {
    throw new Error('Expected widget registry Value cells to route through the shared inline Value adapter')
  }
  if (registry.includes('MAIN_PANEL_OPEN_EVENT')) {
    throw new Error('Expected Widget props panel to forbid opening MainPanel Integrations')
  }
  if (!registry.includes('applyConnectedWidgetFieldsToEmptyValues({')) {
    throw new Error('Expected Widget registry section to delegate connected-field autofill to the shared mutation helper')
  }
  if (!registry.includes('applyWidgetFieldValueUpdate({')) {
    throw new Error('Expected Widget registry section to delegate schema-path field updates to the shared mutation helper')
  }
  if (!registry.includes('resolveWidgetRegistryApiDocRef({')) {
    throw new Error('Expected Widget registry section to delegate API doc resolution to the shared registry helper')
  }
  if (!registry.includes('resolveWidgetRegistryMainPanelLink({')) {
    throw new Error('Expected Widget registry section to delegate port deep-link resolution to the shared registry helper')
  }
  if (registry.includes('resolveOpenAiTextWidgetChatApiRowKey(') || registry.includes('resolveBytePlusTextWidgetSharedTextApiRowKey(')) {
    throw new Error('Expected Widget registry section to stop importing provider-specific text widget API resolvers directly')
  }

  const fieldMutation = readUtf8(fieldMutationPath)
  if (!fieldMutation.includes('export function normalizeWidgetFieldSchemaPath')) {
    throw new Error('Expected widget field schema-path normalization to live in the shared mutation helper')
  }

  const registryTemplates = readUtf8(registryTemplatesPath)
  if (!registryTemplates.includes('export function resolveWidgetRegistryApiDocRef')) {
    throw new Error('Expected registry API doc resolution to live in the shared registry helper module')
  }
  if (!registryTemplates.includes('export function resolveWidgetRegistryMainPanelLink')) {
    throw new Error('Expected registry main-panel deep-link resolution to live in the shared registry helper module')
  }
}
