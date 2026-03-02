import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorSelectModeOverridesSingleToMulti() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('readEffectiveSelectMode')) {
    throw new Error('expected FlowCanvas interactions to include an effective select mode helper')
  }
  if (!text.includes("String(st.canvas2dRenderer || '') === 'flowEditor'")) {
    throw new Error('expected FlowCanvas interactions to detect FlowEditor renderer mode')
  }
  if (!text.includes("return base === 'lasso' ? 'lasso' : 'multi'")) {
    throw new Error('expected FlowEditor to treat single-select schemas as multi-select for collective drags')
  }
}
