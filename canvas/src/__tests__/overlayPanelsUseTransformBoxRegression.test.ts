import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3RichMediaOverlayDoesNotForceLeftTopPanelBox() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'components', 'RichMediaOverlayLayer2d.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('data-kg-panel-box="leftTop"') || text.includes("data-kg-panel-box='leftTop'")) {
    throw new Error('expected D3 rich media overlays to use transform positioning (not left/top)')
  }
}

export function testMarkdownDesignOverlayDoesNotForceLeftTopPanelBox() {
  const p = resolve(process.cwd(), 'src', 'features', 'markdown-edgeless', 'MarkdownDesignOverlay.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('data-kg-panel-box="leftTop"') || text.includes("data-kg-panel-box='leftTop'")) {
    throw new Error('expected markdown design overlays to use transform positioning (not left/top)')
  }
}

