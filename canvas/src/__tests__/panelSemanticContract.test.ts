import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testPanelHeaderUsesAriaTablist = () => {
  const root = process.cwd()
  const tabHeaderPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'TabHeader.tsx')
  const text = readUtf8(tabHeaderPath)
  if (!text.includes('role="tablist"') && !text.includes("role='tablist'")) {
    throw new Error('Expected TabHeader to render a tablist role')
  }
  if (!text.includes('role="tab"') && !text.includes("role='tab'")) {
    throw new Error('Expected TabHeader to render tab roles')
  }
}

export const testMainPanelContainerUsesKgPanelBg = () => {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'MainPanelContainer.tsx')
  const text = readUtf8(filePath)
  if (text.includes('var(--panel-bg)')) throw new Error('Expected MainPanelContainer to avoid var(--panel-bg)')
  if (!text.includes('var(--kg-panel-bg)')) throw new Error('Expected MainPanelContainer to use var(--kg-panel-bg)')
}

