import { TOOL_MENU_AREAS } from '@/features/toolbar/toolMenu'

export function testToolMenuDoesNotExposeCuratorArea() {
  const curator = TOOL_MENU_AREAS.find(a => a.key === ('curator' as never))
  if (curator) {
    throw new Error('Tool menu must not expose a Curator area; use Source Files instead')
  }
}
