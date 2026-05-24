import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignCanvasFiltersAvoidRelativeSvgLengths() {
  const shellPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'DesignCanvasRenderShell.tsx')
  const shellText = readFileSync(shellPath, 'utf8')

  if (!shellText.includes('filterUnits="objectBoundingBox"')) {
    throw new Error('expected DesignCanvas filters to opt into objectBoundingBox units for stable numeric bounds')
  }
  if (shellText.includes('x="-20%"') || shellText.includes('y="-20%"') || shellText.includes('width="140%"') || shellText.includes('height="140%"')) {
    throw new Error('expected DesignCanvas filters to avoid percentage SVG lengths that can trigger SVGLength readback failures')
  }
}
