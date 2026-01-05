import { JSON_EDITOR_LINE_HEIGHT_REM } from '@/features/json/JsonEditor'

export function testJsonEditorLineHeightConstant() {
  if (JSON_EDITOR_LINE_HEIGHT_REM !== 1) throw new Error('JsonEditor line-height constant mismatch')
}
