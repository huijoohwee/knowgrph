import { TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'

export function testToolMenuDoesNotExposeLegacyArea() {
  const areaKeys = TOOL_MENU_AREAS.map(area => area.key)
  const expectedAreaKeys = [
    'sourceFiles',
    'validation',
    'parser',
    'schemaConfig',
    'graphFields',
    'orchestrator',
    'render',
    'settings',
    'history',
  ]
  if (areaKeys.length !== expectedAreaKeys.length) {
    throw new Error('Tool menu must expose only the canonical areas')
  }
  if (expectedAreaKeys.some((key, index) => areaKeys[index] !== key)) {
    throw new Error('Tool menu area order must stay aligned with the canonical surfaces')
  }
}
