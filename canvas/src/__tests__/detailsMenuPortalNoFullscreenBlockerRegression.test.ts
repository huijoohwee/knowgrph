import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDetailsMenuPortalDoesNotInstallBlockingFullscreenLayer() {
  const p = resolve(process.cwd(), 'src', 'components', 'ui', 'DetailsMenu.tsx')
  const text = readFileSync(p, 'utf8')
  const needle = "inset: 0, zIndex: Z_INDEX_MENU, pointerEvents: 'none'"
  if (!text.includes(needle)) {
    throw new Error('expected DetailsMenu portal root to be pointerEvents none to avoid blocking canvas interactions')
  }
}
