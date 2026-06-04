import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testDesignDomInspectRowsUseResponsiveOwner() {
  const panelText = readUtf8('src/features/design/DesignDomInspectPanel.tsx')
  const cssText = readUtf8('src/styles/design-dom-inspect-responsive.css')
  const indexCssText = readUtf8('src/index.css')

  if (!panelText.includes("DESIGN_DOM_INSPECT_ROW_GRID_CLASS_NAME = 'kg-design-dom-inspect-row-grid'")) {
    throw new Error('expected Design DOM inspector rows to expose one responsive grid owner')
  }
  if (!panelText.includes('className={DESIGN_DOM_INSPECT_ROW_GRID_CLASS_NAME}')) {
    throw new Error('expected Design DOM inspector rows to consume the responsive grid owner')
  }
  if (panelText.includes('grid grid-cols-[110px_1fr]')) {
    throw new Error('expected Design DOM inspector rows to avoid inline fixed key/value grid tracks')
  }
  if (!indexCssText.includes("@import './styles/design-dom-inspect-responsive.css';")) {
    throw new Error('expected app CSS to import the Design DOM inspector responsive stylesheet')
  }
  if (!cssText.includes('.kg-design-dom-inspect-row-grid') || !cssText.includes('--kg-design-dom-inspect-label-width')) {
    throw new Error('expected Design DOM inspector responsive CSS to own the label column width')
  }
  if (!cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected Design DOM inspector responsive CSS to stay mobile-first')
  }
}
