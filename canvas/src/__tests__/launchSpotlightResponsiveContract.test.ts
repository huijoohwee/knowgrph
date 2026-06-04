import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testLaunchSpotlightViewportStatusGridUsesResponsiveOwner() {
  const ownerText = readUtf8('src/features/spotlight/launchSpotlightResponsiveClasses.ts')
  const cardText = readUtf8('src/features/spotlight/LaunchSpotlightStatusCard.tsx')

  if (!ownerText.includes("LAUNCH_SPOTLIGHT_VIEWPORT_STATUS_GRID_CLASS_NAME =")) {
    throw new Error('expected Launch Spotlight viewport status grid to expose one responsive owner')
  }
  if (!ownerText.includes('grid min-w-0 grid-cols-1') || !ownerText.includes('sm:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)]')) {
    throw new Error('expected Launch Spotlight viewport status grid owner to stay mobile-first')
  }
  if (!cardText.includes('className={LAUNCH_SPOTLIGHT_VIEWPORT_STATUS_GRID_CLASS_NAME}')) {
    throw new Error('expected Launch Spotlight viewport status grid to consume the responsive owner')
  }
  if (cardText.includes('grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1')) {
    throw new Error('expected Launch Spotlight viewport status grid to avoid inline fixed desktop grid tracks')
  }
}
