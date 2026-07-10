import fs from 'node:fs'
import path from 'node:path'

export function testGraphDataTableToolbarUsesPortalMenusToAvoidClipping() {
  const filePath = path.resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'GraphDataTableToolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  if (!text.includes('DetailsMenu')) throw new Error('expected GraphDataTableToolbar to use DetailsMenu')
  if (!text.includes('portal')) throw new Error('expected GraphDataTableToolbar menus to use portal positioning')
}
