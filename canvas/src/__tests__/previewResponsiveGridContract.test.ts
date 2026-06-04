import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testPreviewPanelAndGalleryGridsUseResponsiveOwners() {
  const panelText = readUtf8('src/lib/panels/views/PreviewPanelView.impl.tsx')
  const galleryText = readUtf8('src/lib/panels/views/preview-panel/ui/PreviewGallery.impl.tsx')
  const indexCssText = readUtf8('src/index.css')
  const previewPanelCssText = readUtf8('src/styles/preview-panel-responsive.css')

  if (!panelText.includes("PREVIEW_PANEL_MEDIA_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'") || panelText.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2')) {
    throw new Error('expected Preview Panel media grid to use a mobile-first responsive owner')
  }
  if (!galleryText.includes("PREVIEW_GALLERY_GRID_CLASS_NAME = 'grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2'") || galleryText.includes('grid grid-cols-1 md:grid-cols-2 gap-3')) {
    throw new Error('expected Preview Gallery grid layout to use a mobile-first responsive owner')
  }
  if (!panelText.includes('PREVIEW_PANEL_MEDIA_FRAME_CLASS_NAME') || !panelText.includes('kg-preview-panel-media-frame')) {
    throw new Error('expected Preview Panel active media frame to use a shared responsive frame owner')
  }
  if (panelText.includes('aspect-video w-full max-w-4xl')) {
    throw new Error('expected Preview Panel to avoid inline active media max-width frame sizing')
  }
  if (!indexCssText.includes("@import './styles/preview-panel-responsive.css';")) {
    throw new Error('expected app CSS to import the Preview Panel responsive frame stylesheet')
  }
  if (!previewPanelCssText.includes('.kg-preview-panel-media-frame') || !previewPanelCssText.includes('--kg-preview-panel-media-frame-max-width')) {
    throw new Error('expected Preview Panel responsive CSS to own the bounded media frame width')
  }
}
