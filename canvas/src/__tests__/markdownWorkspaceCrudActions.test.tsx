import React from 'react'
import { createRoot } from 'react-dom/client'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async () => {
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0)
  })
}

const findButtonByAriaLabel = (root: ParentNode, label: string): HTMLButtonElement | null => {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
  for (const btn of buttons) {
    if (String(btn.getAttribute('aria-label') || '') === label) return btn
  }
  return null
}

export async function testMarkdownWorkspaceExplorerCrudActionsCreateAndDeleteFile() {
  const { dom, restore: restoreDom } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('div')
  container.id = 'root'
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    const fs = await getWorkspaceFs()
    await fs.ensureSeed()
    const beforeEntries = await fs.listEntries()
    const beforePaths = new Set(beforeEntries.map(e => e.path))

    root.render(React.createElement(BottomPanelMarkdownSection))

    let newFileBtn: HTMLButtonElement | null = null
    for (let i = 0; i < 60; i += 1) {
      await tick()
      newFileBtn = findButtonByAriaLabel(container, 'New file')
      if (newFileBtn) break
    }
    if (!newFileBtn) throw new Error('New file button not found')

    newFileBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let createdPath: string | null = null
    for (let i = 0; i < 80; i += 1) {
      await tick()
      const entries = await fs.listEntries()
      const candidates = entries
        .filter(e => e.kind === 'file')
        .filter(e => !beforePaths.has(e.path))
        .filter(e => String(e.name || '').startsWith('note') && String(e.name || '').endsWith('.md'))
      if (candidates.length === 0) continue
      candidates.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0))
      createdPath = candidates[0]?.path ?? null
      break
    }
    if (!createdPath) throw new Error('Expected new note*.md file to be created')

    const actionsBtnLabel = `Actions for ${createdPath.split('/').pop()}`
    let actionsBtn: HTMLButtonElement | null = null
    for (let i = 0; i < 80; i += 1) {
      await tick()
      actionsBtn = findButtonByAriaLabel(container, actionsBtnLabel)
      if (actionsBtn) break
    }
    if (!actionsBtn) throw new Error('Selection actions button not found')

    actionsBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    let deleteBtn: HTMLButtonElement | null = null
    for (let i = 0; i < 40; i += 1) {
      await tick()
      const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
      deleteBtn = buttons.find(b => String(b.textContent || '').trim() === 'Delete') || null
      if (deleteBtn) break
    }
    if (!deleteBtn) throw new Error('Delete menu item not found')

    deleteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    for (let i = 0; i < 80; i += 1) {
      await tick()
      const entries = await fs.listEntries()
      if (!entries.some(e => e.path === createdPath)) {
        createdPath = null
        break
      }
    }
    if (createdPath) throw new Error('Expected created file to be deleted')
  } finally {
    try {
      root.unmount()
    } catch {
      void 0
    }
    restoreDom()
  }
}
