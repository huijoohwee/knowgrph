import fs from 'node:fs'
import path from 'node:path'

export function testGraphTableToolbarUsesPortalMenusToAvoidClipping() {
  const filePath = path.resolve(process.cwd(), 'src', 'features', 'graph-table', 'ui', 'GraphTableToolbar.tsx')
  const text = fs.readFileSync(filePath, { encoding: 'utf8' })
  if (!text.includes('DetailsMenu')) throw new Error('expected GraphTableToolbar to use DetailsMenu')
  if (!text.includes('portal')) throw new Error('expected GraphTableToolbar menus to use portal positioning')
}

