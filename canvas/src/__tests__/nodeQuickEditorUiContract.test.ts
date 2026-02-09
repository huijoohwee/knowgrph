import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testNodeQuickEditorHidesIdentityAndMovesActionsToToolbar = () => {
  const root = process.cwd()
  const panelPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const formPath = path.resolve(root, 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')

  const panel = readUtf8(panelPath)
  if (panel.includes('<p')) {
    throw new Error('Node Quick Editor panel header must not render <p> elements')
  }
  if (panel.includes('mt-0.5')) {
    throw new Error('Node Quick Editor header must not render a subtitle line under the title')
  }
  if (!panel.includes('flowNodeQuickEditorValidate')) {
    throw new Error('Expected Validate action to live in Node Quick Editor toolbar')
  }
  if (!panel.includes('Minimize2') || !panel.includes('Maximize2')) {
    throw new Error('Expected Minimize/Restore icon buttons in Node Quick Editor toolbar')
  }
  if (!panel.includes('{active &&')) {
    throw new Error('Expected Node Quick Editor toolbar to be shown only when active')
  }

  const form = readUtf8(formPath)
  if (form.includes("rowKey: 'node-type'")) {
    throw new Error('Expected Node Type identity row to be removed from Node Quick Editor form')
  }
  if (form.includes('flowNodeQuickEditorValidate')) {
    throw new Error('Expected Validate button to be removed from Node Quick Editor form body')
  }
  if (form.includes('{entry.quickEditorTypeId}') || form.includes('{entry.formId}') || form.includes('· {entry.formId}')) {
    throw new Error('Expected Quick Editor Type and Form ID to be hidden from Node Quick Editor UI labels')
  }
  if (!form.includes("px-3 py-0")) {
    throw new Error('Expected Node Quick Editor form to have zero top/bottom padding')
  }
}
