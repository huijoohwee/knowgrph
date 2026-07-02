import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testStoryboardWidgetMappingLayoutUsesResponsiveOwner() {
  const layoutText = readUtf8('src/features/storyboard-widget-manager/StoryboardWidgetMappingTabLayout.tsx')
  const cssText = readUtf8('src/styles/storyboard-widget-manager-responsive.css')
  const indexCssText = readUtf8('src/index.css')

  if (!layoutText.includes("STORYBOARD_WIDGET_MAPPING_LAYOUT_CLASS_NAME = 'kg-storyboard-widget-mapping-layout'")) {
    throw new Error('expected Storyboard Widget mapping layout to expose one responsive split owner')
  }
  if (!layoutText.includes('className={STORYBOARD_WIDGET_MAPPING_LAYOUT_CLASS_NAME}')) {
    throw new Error('expected Storyboard Widget mapping layout to consume the responsive split owner')
  }
  if (layoutText.includes('grid grid-cols-1 lg:grid-cols-[1fr_520px]')) {
    throw new Error('expected Storyboard Widget mapping layout to avoid inline fixed desktop split tracks')
  }
  if (!indexCssText.includes("@import './styles/storyboard-widget-manager-responsive.css';")) {
    throw new Error('expected app CSS to import the Storyboard Widget Manager responsive stylesheet')
  }
  if (!cssText.includes('.kg-storyboard-widget-mapping-layout') || !cssText.includes('--kg-storyboard-widget-mapping-panel-width')) {
    throw new Error('expected Storyboard Widget Manager responsive CSS to own the mapping panel width')
  }
  if (!cssText.includes('grid-template-columns: minmax(0, 1fr)')) {
    throw new Error('expected Storyboard Widget mapping layout CSS to stay mobile-first')
  }
}
