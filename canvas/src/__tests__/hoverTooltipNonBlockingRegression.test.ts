import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphHoverTooltipIsNonInteractiveByDefault() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphHoverTooltip.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('tooltipInteractive = false')) {
    throw new Error('expected GraphHoverTooltip default to be non-interactive to avoid blocking canvas')
  }
}

export function testGraphCanvasRootDisablesHoverTooltipInteractivity() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('tooltipInteractive={false}')) {
    throw new Error('expected GraphCanvasRoot to pass tooltipInteractive={false} to GraphHoverTooltip')
  }
}
