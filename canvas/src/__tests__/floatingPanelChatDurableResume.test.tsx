import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import FloatingPanelChat from '@/features/chat/FloatingPanelChat'
import {
  clearActiveDurableChatStreamRun,
  writeActiveDurableChatStreamRun,
} from '@/features/chat/floatingPanelChat/floatingPanelChatDurableStream'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { resetWorkspaceFsForTests } from '@/features/workspace-fs/workspaceFs'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { mountReactRoot, unmountReactRoot, waitForFrames, waitForTasks } from '@/tests/lib/reactRootHarness'

const findFooterButton = (container: Element, label: string): HTMLButtonElement | null => {
  return (Array.from(container.querySelectorAll('button')) as HTMLButtonElement[])
    .find(button => String(button.textContent || '').trim() === label) || null
}

export async function testFloatingPanelChatDurableResumeSettlesBeforeNewChat() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)
  resetWorkspaceFsForTests()
  useGraphStore.getState().resetAll()
  useGraphStore.getState().setChatStorageTarget('chatKnowgrph')
  useGraphStore.getState().setChatKnowgrphWorkspacePath('/workspace/chat/20260707T000000Z/kgc_20260707T000000Z.md')
  useMarkdownExplorerStore.getState().setActivePath(null)
  writeActiveDurableChatStreamRun({
    runId: 'resume-loop-guard',
    traceId: 'resume-loop-guard',
    assistantMessageId: 'assistant-resume-loop-guard',
    requestText: 'resume this stream',
    requestTimestampMs: Date.UTC(2026, 6, 7),
    chatStorageTarget: 'chatKnowgrph',
    liveKgcPath: '/workspace/chat/20260707T000000Z/kgc_20260707T000000Z.md',
    providerSummary: 'Test Provider',
    defaultLocalRootPath: '/workspace/chat',
    modelId: 'gpt-5-nano',
  })

  try {
    await mountReactRoot(root, React.createElement(FloatingPanelChat), {
      window: dom.window as unknown as Window,
      frames: 2,
      tasks: 2,
    })
    let newChatButton: HTMLButtonElement | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await act(async () => {
        await waitForTasks(1)
        await waitForFrames(dom.window as unknown as Window, 1)
      })
      newChatButton = findFooterButton(container, 'New Chat')
      if (newChatButton && !newChatButton.disabled) break
    }
    if (!newChatButton) throw new Error('expected FloatingPanel chat to render the New Chat command')
    if (newChatButton.disabled) throw new Error('expected durable resume failure to settle and re-enable New Chat')
    if (findFooterButton(container, 'Sending…')) {
      throw new Error('expected durable resume failure to leave the footer out of Sending state')
    }
  } finally {
    await unmountReactRoot(root, { window: dom.window as unknown as Window })
    clearActiveDurableChatStreamRun('resume-loop-guard')
    container.remove()
    useMarkdownExplorerStore.getState().setActivePath(null)
    useGraphStore.getState().resetAll()
    resetWorkspaceFsForTests()
    restore()
  }
}
