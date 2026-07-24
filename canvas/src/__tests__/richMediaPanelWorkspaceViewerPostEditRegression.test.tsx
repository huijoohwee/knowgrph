import React from 'react'
import { createRoot } from 'react-dom/client'
import { RichMediaPanelWorkspaceViewerSurface } from '@/components/RichMediaPanelWorkspaceViewerSurface'
import type { RichMediaPanelProps } from '@/components/RichMediaPanel.types'
import type { RichMediaPanelModel } from '@/components/useRichMediaPanelModel'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForTasks } from '@/tests/lib/reactRootHarness'
import { resolveRepoTestDataPath } from '@/tests/lib/repoTestData'
import { readFileSync } from 'node:fs'

export async function testRichMediaWorkspaceViewerRetainsCommittedDraftUntilParentPersistence() {
  const { dom, restore } = initJsdomHarness()
  try {
    await import('@/features/markdown/ui/MarkdownPreview')
    const container = dom.window.document.createElement('section')
    dom.window.document.body.appendChild(container)
    const root = createRoot(container)
    const markdown = readFileSync(resolveRepoTestDataPath('probe-tree-rich-media-edit-parity.md'), 'utf8')
    const panelChanges: Array<{ text?: string }> = []
    const model = {
      panelTextEditable: true,
      panelDisplayText: markdown,
      panelMarkdownDocumentPath: '/fixtures/probe-tree-rich-media-edit-parity.md',
      setPanelDraftText: () => void 0,
    } as unknown as RichMediaPanelModel
    const props = {
      title: 'Probe-Tree Branches',
      url: '',
      kind: 'iframe',
      onPanelChange: next => {
        panelChanges.push(next)
      },
    } as RichMediaPanelProps

    await mountReactRoot(
      root,
      <RichMediaPanelWorkspaceViewerSurface model={model} props={props} />,
      { window: dom.window, frames: 24 },
    )

    const question = Array.from(container.querySelectorAll('p[data-start-line]') as NodeListOf<HTMLElement>)
      .find(element => String(element.textContent || '').includes('For SGD800预算'))
    if (!question) throw new Error(`expected production-shaped Probe-Tree question, html=${container.innerHTML}`)
    question.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 42,
      width: 400,
      height: 42,
      toJSON: () => ({}),
    } as DOMRect)
    question.dispatchEvent(new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 8,
      clientY: 8,
    }))
    await waitForTasks(2)
    await waitForFrames(dom.window, 2)

    const editor = question.querySelector('[contenteditable="true"]') as HTMLElement | null
    const strong = editor?.querySelector('strong')
    if (!editor || !strong) throw new Error(`expected rendered question editor, html=${question.innerHTML}`)
    const editedQuestion = 'What is the most impactful missing variable for this sourcing decision?'
    strong.textContent = editedQuestion
    editor.dispatchEvent(new dom.window.InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: editedQuestion,
    }))
    await waitForTasks(4)
    await waitForFrames(dom.window, 2)
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      ctrlKey: true,
    }))
    await waitForTasks(8)
    await waitForFrames(dom.window, 4)

    const committedQuestion = Array.from(container.querySelectorAll('strong') as NodeListOf<HTMLElement>)
      .find(element => String(element.textContent || '').includes(editedQuestion))
    if (container.querySelector('[contenteditable="true"][aria-label="Edit markdown block"]')) {
      throw new Error('expected the committed question to return to the Viewer surface')
    }
    if (!committedQuestion?.closest('li[data-kg-list-item-index="0"]')) {
      throw new Error(`expected the committed question to remain visible in its first ordered-list row while parent persistence catches up, html=${container.innerHTML}`)
    }
    if (!panelChanges.at(-1)?.text?.includes(`1. **${editedQuestion}**`)) {
      throw new Error(`expected the parent persistence payload to preserve the ordered-list marker, got ${JSON.stringify(panelChanges)}`)
    }

    await unmountReactRoot(root, { window: dom.window })
  } finally {
    restore()
  }
}
