import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { createRoot } from 'react-dom/client'
import SkillsCommandsView from '@/features/panels/views/SkillsCommandsView'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot } from '@/tests/lib/reactRootHarness'

export async function testMainPanelSkillsCommandsViewRendersSlashInvokableSkills() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    await mountReactRoot(root, React.createElement(SkillsCommandsView, { searchQuery: '' }), {
      window: dom.window as unknown as Window,
      frames: 2,
    })

    const surface = container.querySelector('[data-kg-main-panel-skills-commands="true"]')
    const storybuildingRow = container.querySelector('[data-kg-skill-command-row="storybuilding"]')
    const storybuildingSlash = container.querySelector('[data-kg-skill-command-slash="storybuilding"]')
    if (!surface || !storybuildingRow || storybuildingSlash?.textContent?.trim() !== '/storybuilding') {
      throw new Error('Expected MainPanel Skills & Commands to render Storybuilding as a slash-invokable skill')
    }

    await mountReactRoot(root, React.createElement(SkillsCommandsView, { searchQuery: 'missing-skill' }), {
      window: dom.window as unknown as Window,
      frames: 2,
    })
    if (container.querySelector('[data-kg-skill-command-row="storybuilding"]')) {
      throw new Error('Expected Skills & Commands search to filter non-matching skills')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    container.remove()
    restore()
  }
}

export function testMainPanelSkillsCommandsIsRegisteredInSharedMainPanelOwners() {
  const repoRoot = process.cwd()
  const mainPanelTabs = readFileSync(resolve(repoRoot, 'src/features/panels/mainPanelTabs.ts'), 'utf8')
  const mainPanel = readFileSync(resolve(repoRoot, 'src/features/panels/MainPanel.tsx'), 'utf8')
  const iconLibrary = readFileSync(resolve(repoRoot, 'src/features/panels/ui/mainPanelHelpIconLibrary.tsx'), 'utf8')

  if (!mainPanelTabs.includes("key: 'skillsCommands'") || !mainPanelTabs.includes("label: 'Skills & Commands'")) {
    throw new Error('Expected Skills & Commands to be registered through MainPanel tab metadata')
  }
  if (!mainPanel.includes('SkillsCommandsViewLazy') || !mainPanel.includes('main-panel-skillsCommands-panel')) {
    throw new Error('Expected MainPanel to lazy-render the centralized Skills & Commands surface')
  }
  if (!iconLibrary.includes("'mainPanel.skillsCommands'") || !iconLibrary.includes("skillsCommands: 'mainPanel.skillsCommands'")) {
    throw new Error('Expected Skills & Commands to use the shared MainPanel icon registry')
  }
}
