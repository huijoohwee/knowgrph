import fs from 'node:fs'
import path from 'node:path'

export function testDesignWireframeCacheEpochAffectsLayoutCacheKey() {
  const filePath = path.resolve(process.cwd(), 'src/components/DesignCanvas.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('layout:v2:e=')) {
    throw new Error('Expected webpage layout cache key to include an epoch so wireframe cache clears are respected')
  }
  if (!text.includes('designWireframeCacheEpoch')) {
    throw new Error('Expected DesignCanvas to depend on designWireframeCacheEpoch')
  }
}

export function testDesignWireframeSettingsExposesClearCache() {
  const filePath = path.resolve(process.cwd(), 'src/features/toolbar/ui/DesignWireframeSettings.tsx')
  let text = ''
  try {
    text = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
  if (!text.includes('Clear cache')) {
    throw new Error('Expected DesignWireframeSettings to render a Clear cache button')
  }
  if (!text.includes('clearCachedWebpageLayoutSnapshots') || !text.includes('clearWebpageIframeSrcdocCaches')) {
    throw new Error('Expected Clear cache to clear webpage layout + iframe srcdoc caches')
  }
}

