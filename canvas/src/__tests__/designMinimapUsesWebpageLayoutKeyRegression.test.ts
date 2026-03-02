import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignMinimapUsesWebpageLayoutKey() {
  const p = resolve(process.cwd(), 'src', 'lib', 'canvas', 'active-2d-zoom-view-key.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("canvas2dRenderer !== 'design'")) {
    throw new Error('expected active 2d zoom view key to special-case design renderer')
  }
  if (!text.includes('designRendererWebpageLayoutKey')) {
    throw new Error('expected active 2d zoom view key to accept designRendererWebpageLayoutKey')
  }
  const minimap = readFileSync(resolve(process.cwd(), 'src', 'features', 'minimap', 'Minimap.tsx'), 'utf8')
  if (!minimap.includes('designRendererWebpageLayoutKey')) {
    throw new Error('expected Minimap to include designRendererWebpageLayoutKey in zoom view key derivation')
  }
}
