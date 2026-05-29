import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => {
  return fs.readFileSync(absPath, { encoding: 'utf8' })
}

export const testMainPanelTypeIconsReuseSharedSsot = () => {
  const root = process.cwd()
  const ssotText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'ui', 'mainPanelTypeIcons.tsx'))
  const collaborationText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'CollaborationView.tsx'))
  const settingsEntryText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'SettingsEntryRow.tsx'))
  const mainPanelText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'MainPanel.tsx'))
  const floatingPanelText = readUtf8(path.resolve(root, 'src', 'lib', 'toolbar', 'ToolbarToolMenu.impl.tsx'))
  const helpIconsText = readUtf8(path.resolve(root, 'src', 'features', 'panels', 'views', 'HelpIconsSection.tsx'))

  if (!ssotText.includes('MAIN_PANEL_TYPE_ICON_META_BY_KEY')) {
    throw new Error('Expected MainPanel type icon metadata to have a shared SSOT')
  }
  ;[
    'collaboration.peer',
    'setting.text',
    'setting.boolean',
    'mainPanel.integrations',
    'mainPanel.mcp',
    'mainPanel.maps',
    'mainPanel.payments',
    'mainPanel.settings',
    'floatingPanel.chat',
    'floatingPanel.graphTraversal',
  ].forEach(token => {
    if (!ssotText.includes(token)) {
      throw new Error(`Expected MainPanel type icon SSOT to include ${token}`)
    }
  })

  if (collaborationText.includes("from 'lucide-react'")) {
    throw new Error('Expected Collaboration Type icons to come from mainPanelTypeIcons, not local lucide imports')
  }
  if (!collaborationText.includes("from '@/features/panels/ui/mainPanelTypeIcons'")) {
    throw new Error('Expected CollaborationView to reuse the MainPanel Type icon SSOT')
  }
  if (!settingsEntryText.includes('resolveMainPanelSettingTypeIconKey') || !settingsEntryText.includes('<MainPanelTypeIcon')) {
    throw new Error('Expected SettingsEntryRow to reuse the MainPanel Type icon resolver')
  }
  if (settingsEntryText.includes("from '@/features/graph-fields/ui/graphFieldIcons'")) {
    throw new Error('Expected SettingsEntryRow to avoid the legacy Graph Fields type icon path for MainPanel Type rows')
  }
  if (!mainPanelText.includes('MAIN_PANEL_TAB_TYPE_ICON_BY_KEY') || mainPanelText.includes('tabIconByKey={{')) {
    throw new Error('Expected MainPanel tab icons to reuse the shared type icon map')
  }
  if (!floatingPanelText.includes('FLOATING_PANEL_TYPE_ICON_BY_VIEW')) {
    throw new Error('Expected FloatingPanel view icons to reuse the shared type icon map')
  }
  ;['GitBranch', 'Hand,', 'LayoutGrid', 'Map,', 'MessageCircle', 'MonitorPlay', 'Palette', 'SlidersHorizontal'].forEach(token => {
    if (floatingPanelText.includes(token)) {
      throw new Error(`Expected FloatingPanel to avoid local view icon import ${token}`)
    }
  })
  if (!helpIconsText.includes('MAIN_PANEL_HELP_TYPE_ICON_KEYS') || !helpIconsText.includes('getMainPanelTypeIconMeta')) {
    throw new Error('Expected Help Icon Library to render MainPanel Type icons from the shared SSOT')
  }
}
