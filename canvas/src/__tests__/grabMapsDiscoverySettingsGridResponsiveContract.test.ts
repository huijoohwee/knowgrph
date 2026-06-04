import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testGrabMapsDiscoverySettingsGridUsesResponsiveOwner() {
  const gridText = readUtf8('src/features/toolbar/GrabMapsDiscoverySettingsGrid.tsx')
  const cssText = readUtf8('src/styles/grabmaps-discovery-responsive.css')
  const indexCssText = readUtf8('src/index.css')

  if (!gridText.includes("GRABMAPS_DISCOVERY_SETTINGS_GRID_CLASS_NAME = 'kg-grabmaps-discovery-settings-grid'")) {
    throw new Error('expected GrabMaps Discovery settings grid to expose one responsive grid owner')
  }
  if (!gridText.includes('className={`${GRABMAPS_DISCOVERY_SETTINGS_GRID_CLASS_NAME}')) {
    throw new Error('expected GrabMaps Discovery settings rows to consume the responsive grid owner')
  }
  if (gridText.includes('grid grid-cols-[1.6fr_0.8fr_1.6fr]')) {
    throw new Error('expected GrabMaps Discovery settings grid to avoid repeated inline arbitrary grid tracks')
  }
  if (!indexCssText.includes("@import './styles/grabmaps-discovery-responsive.css';")) {
    throw new Error('expected app CSS to import the GrabMaps Discovery responsive stylesheet')
  }
  if (!cssText.includes('.kg-grabmaps-discovery-settings-grid') || !cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected GrabMaps Discovery responsive CSS to own the mobile-first grid columns')
  }
  if (!cssText.includes('@media (min-width: 640px)') || !cssText.includes('minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 1.6fr)')) {
    throw new Error('expected GrabMaps Discovery responsive CSS to own the wider three-column grid tracks')
  }
}
