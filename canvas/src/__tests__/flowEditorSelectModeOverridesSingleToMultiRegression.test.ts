import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorSelectModeOverridesSingleToMulti() {
  const bindPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'bindFlowCanvasNativeInteractions.ts')
  const bindText = readFileSync(bindPath, 'utf8')
  if (!bindText.includes('readEffectiveSelectMode')) {
    throw new Error('expected FlowCanvas interactions to include an effective select mode helper')
  }
  if (!bindText.includes("return base === 'lasso' ? 'lasso' : 'multi'")) {
    throw new Error('expected FlowEditor to treat single-select schemas as multi-select for collective drags')
  }

  const pointerDownPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'pointerDown.ts')
  const pointerDownText = readFileSync(pointerDownPath, 'utf8')
  if (!pointerDownText.includes("String(storeStateAtDown.canvas2dRenderer || '') === 'flowEditor'")) {
    throw new Error('expected FlowCanvas pointerdown to detect FlowEditor renderer mode')
  }
}
