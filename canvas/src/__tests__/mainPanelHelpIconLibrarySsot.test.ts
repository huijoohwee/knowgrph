import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

const collectSourceFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(absPath)
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) return []
    return [absPath]
  })
}

export const testMainPanelHelpIconLibraryReusesSharedSsot = () => {
  const root = process.cwd()
  const staleSsotPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'mainPanelTypeIcons.tsx')
  const libraryPath = path.resolve(root, 'src', 'features', 'panels', 'ui', 'mainPanelHelpIconLibrary.tsx')
  const guardTestPath = path.resolve(root, 'src', '__tests__', 'mainPanelHelpIconLibrarySsot.test.ts')
  const ssotText = readUtf8(libraryPath)
  const collaborationText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'CollaborationView.tsx'))
  const settingsEntryText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsEntryRow.tsx'))
  const mainPanelText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'MainPanel.tsx'))
  const floatingPanelText = readUtf8(path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'))
  const helpIconsText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'HelpIconsSection.tsx'))
  const sourceTexts = collectSourceFiles(path.resolve(root, 'src')).map(absPath => [absPath, readUtf8(absPath)] as const)
  const staleImportHits = sourceTexts
    .filter(([absPath, text]) => absPath !== guardTestPath && text.includes('@/features/panels/ui/mainPanelTypeIcons'))
    .map(([absPath]) => path.relative(root, absPath))

  if (!ssotText.includes('MAIN_PANEL_TYPE_ICON_META_BY_KEY')) {
    throw new Error('Expected MainPanel Help Icon Library metadata to have a shared SSOT')
  }
  if (fs.existsSync(staleSsotPath)) {
    throw new Error('Expected stale mainPanelTypeIcons module to be removed in favor of the Help Icon Library')
  }
  if (staleImportHits.length > 0) {
    throw new Error(`Expected no stale mainPanelTypeIcons imports, found: ${staleImportHits.join(', ')}`)
  }
  if (!ssotText.includes('export const MAIN_PANEL_TYPE_ICON_KEYS') || !ssotText.includes('export type MainPanelTypeIconKey = (typeof MAIN_PANEL_TYPE_ICON_KEYS)[number]')) {
    throw new Error('Expected MainPanel Type icon keys to be the SSOT for the icon-key type')
  }
  if (ssotText.includes('MAIN_PANEL_HELP_TYPE_ICON_KEYS')) {
    throw new Error('Expected Help Icon Library to avoid a duplicate help-specific Type icon key alias')
  }
  if (ssotText.includes('mainPanel.payments')) {
    throw new Error('Expected MainPanel Type icons to avoid a legacy Payments tab alias after Commerce consolidation')
  }
  ;[
    'collaboration.peer',
    'setting.text',
    'setting.boolean',
    'mainPanel.integrations',
    'mainPanel.mcp',
    'mainPanel.maps',
    'mainPanel.commerce',
    'mainPanel.settings',
    'floatingPanel.chat',
    'floatingPanel.graphTraversal',
    'ktv.type.static',
    'ktv.type.style',
    'ktv.type.action',
    'ktv.type.duration',
    'field.scope.node',
    'field.scope.edge',
    'field.origin.custom',
    'field.origin.derived',
    'field.visibility.show',
    'field.visibility.hide',
    'field.type.singleLineText',
    'field.type.number',
    'field.type.decimal',
    'field.type.checkbox',
  ].forEach(token => {
    if (!ssotText.includes(token)) {
      throw new Error(`Expected MainPanel Help Icon Library to include ${token}`)
    }
  })

  if (collaborationText.includes("from 'lucide-react'")) {
    throw new Error('Expected Collaboration Type icons to come from the Help Icon Library, not local lucide imports')
  }
  if (!collaborationText.includes("from '@/features/panels/ui/mainPanelHelpIconLibrary'")) {
    throw new Error('Expected CollaborationView to reuse the MainPanel Help Icon Library')
  }
  if (!settingsEntryText.includes("from '@/features/panels/ui/mainPanelHelpIconLibrary'")) {
    throw new Error('Expected SettingsEntryRow to reuse the MainPanel Help Icon Library')
  }
  if (!mainPanelText.includes("from '@/features/panels/ui/mainPanelHelpIconLibrary'")) {
    throw new Error('Expected MainPanel tab icons to reuse the MainPanel Help Icon Library')
  }
  if (!floatingPanelText.includes("from '@/features/panels/ui/mainPanelHelpIconLibrary'")) {
    throw new Error('Expected FloatingPanel icons to reuse the MainPanel Help Icon Library')
  }
  if (!helpIconsText.includes("from '@/features/panels/ui/mainPanelHelpIconLibrary'")) {
    throw new Error('Expected HelpIconsSection to render the MainPanel Help Icon Library directly')
  }
  if (!settingsEntryText.includes('resolveMainPanelSettingTypeIconKey') || !settingsEntryText.includes('<MainPanelTypeIcon')) {
    throw new Error('Expected SettingsEntryRow to reuse the MainPanel Type icon resolver')
  }
  if (settingsEntryText.includes('renderTypeAsText') || settingsEntryText.includes('renderTypeLabel')) {
    throw new Error('Expected SettingsEntryRow to avoid replacing Help Icon Library Type icons with text-only Type labels')
  }
  if (settingsEntryText.includes('>{resolvedTypeLabel}</span>')) {
    throw new Error('Expected SettingsEntryRow Type cells to forbid visible Type text and render only the shared Help Icon Library icon')
  }
  if (settingsEntryText.includes("from '@/features/graph-fields/ui/graphFieldIcons'")) {
    throw new Error('Expected SettingsEntryRow to avoid the legacy Graph Fields type icon path for MainPanel Type rows')
  }
  if (!mainPanelText.includes('MAIN_PANEL_TAB_TYPE_ICON_BY_KEY') || mainPanelText.includes('tabIconByKey={{')) {
    throw new Error('Expected MainPanel tab icons to reuse the shared type icon map')
  }
  if (!ssotText.includes('MAIN_PANEL_TAB_TYPE_ICON_KEY_BY_TAB') || !ssotText.includes('getMainPanelTypeIconComponent(iconKey)')) {
    throw new Error('Expected MainPanel tab icons to derive components from the shared semantic icon-key map')
  }
  if (!floatingPanelText.includes('FLOATING_PANEL_TYPE_ICON_BY_VIEW')) {
    throw new Error('Expected FloatingPanel view icons to reuse the shared type icon map')
  }
  if (!ssotText.includes('FLOATING_PANEL_TYPE_ICON_KEY_BY_VIEW') || !ssotText.includes('Object.entries(FLOATING_PANEL_TYPE_ICON_KEY_BY_VIEW)')) {
    throw new Error('Expected FloatingPanel view icons to derive components from the shared semantic icon-key map')
  }
  ;['GitBranch', 'Hand,', 'LayoutGrid', 'Map,', 'MessageCircle', 'MonitorPlay', 'Palette', 'SlidersHorizontal'].forEach(token => {
    if (floatingPanelText.includes(token)) {
      throw new Error(`Expected FloatingPanel to avoid local view icon import ${token}`)
    }
  })
  if (!helpIconsText.includes('MAIN_PANEL_TYPE_ICON_KEYS') || !helpIconsText.includes('getMainPanelTypeIconMeta')) {
    throw new Error('Expected Help Icon Library to render MainPanel Type icons from the shared SSOT')
  }
  if (helpIconsText.includes("from '@/features/graph-fields/ui/graphFieldIcons'")) {
    throw new Error('Expected Help Icon Library rows to avoid graph-field-local Type icon components')
  }
  if (!ssotText.includes('resolveMainPanelKtvTypeIconKey')) {
    throw new Error('Expected MainPanel icon SSOT to own KTV Type label to icon resolution')
  }
  if (!floatingPanelText.includes('resolveMainPanelKtvTypeIconKey') || !floatingPanelText.includes('renderTypeIcon={renderGeospatialTypeIcon}')) {
    throw new Error('Expected FloatingPanel Geo KTV Type icons to be rendered through the MainPanel icon SSOT')
  }
  if (!floatingPanelText.includes('<MainPanelTypeIcon')) {
    throw new Error('Expected FloatingPanel Geo KTV Type cells to use MainPanelTypeIcon')
  }
}
