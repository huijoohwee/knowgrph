import React from 'react'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import { MarkdownBlockContainer } from '@/lib/markdown-core/ui/MarkdownBlockContainerCore.impl.engine.runtime'

const MOBILE_SMOKE_CHAT_MARKDOWN = [
  '# Mobile keyboard smoke',
  '',
  '- keep chat quick bar reachable',
  '- keep workspace quick bar reachable',
  '- preserve context while viewport height shrinks',
].join('\n')

const MOBILE_SMOKE_WORKSPACE_LINES = [
  '## Mobile-first Workspace',
  '',
  'Use the quick bar below to test /, #, and @ reachability while the viewport shrinks.',
]

const mobileShellClassName =
  'mx-auto flex w-full max-w-[390px] flex-col rounded-[28px] border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] shadow-[0_20px_60px_rgba(15,23,42,0.18)]'

export function MobileKeyboardBrowserSmokePage() {
  const [chatInput, setChatInput] = React.useState('')
  const [streamCount, setStreamCount] = React.useState(6)
  const [workspaceLines, setWorkspaceLines] = React.useState(MOBILE_SMOKE_WORKSPACE_LINES)

  const streamItems = React.useMemo(
    () => Array.from({ length: streamCount }, (_, index) => ({
      id: `stream-${index + 1}`,
      text: `Streaming trace ${index + 1}: mobile-safe transcript line remains visible.`,
    })),
    [streamCount],
  )

  const workspacePreview = React.useMemo(() => workspaceLines.join('\n'), [workspaceLines])

  return (
    <main
      data-kg-mobile-keyboard-smoke-page="1"
      className="min-h-screen bg-[var(--kg-canvas-bg)] px-4 py-6 text-[var(--kg-text)]"
      aria-label="Mobile keyboard browser smoke"
    >
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Mobile Keyboard Browser Smoke</h1>
          <p className="max-w-3xl text-sm text-[var(--kg-text-secondary)]">
            Dev-only browser smoke for mobile viewport shrink, quick-bar reachability, and context retention across chat and workspace edit surfaces.
          </p>
        </header>

        <section
          data-kg-mobile-keyboard-shell="chat"
          className={mobileShellClassName}
          aria-label="Chat mobile shell"
        >
          <header className="border-b border-[var(--kg-border)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">FloatingPanel Chat mobile shell</h2>
              <button
                type="button"
                className="rounded-full border border-[var(--kg-border)] px-3 py-1 text-xs font-medium text-[var(--kg-text-secondary)]"
                data-kg-mobile-chat-stream-button="true"
                onClick={() => setStreamCount(previous => previous + 4)}
              >
                Stream update
              </button>
            </div>
          </header>
          <section className="flex min-h-0 flex-1 flex-col">
            <section
              className="flex max-h-[360px] min-h-[280px] flex-col gap-3 overflow-y-auto px-4 py-4"
              data-kg-mobile-chat-stream="true"
            >
              {streamItems.map(item => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] px-3 py-2 text-sm"
                  data-kg-mobile-chat-stream-item={item.id}
                >
                  {item.text}
                </article>
              ))}
            </section>
            <section className="border-t border-[var(--kg-border)] p-3">
              <FloatingPanelChatComposer
                input={chatInput}
                setInput={setChatInput}
                markdownText={MOBILE_SMOKE_CHAT_MARKDOWN}
                isLoading={false}
                isSubmitDisabled={false}
                uiPanelTextFontClass="text-sm leading-6"
                placeholder="Ask a mobile-first question"
              />
            </section>
          </section>
        </section>

        <section
          data-kg-mobile-keyboard-shell="workspace"
          className={mobileShellClassName}
          aria-label="Workspace mobile shell"
        >
          <header className="border-b border-[var(--kg-border)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Markdown workspace mobile shell</h2>
              <span
                className="rounded-full border border-[var(--kg-border)] px-3 py-1 text-xs font-medium text-[var(--kg-text-secondary)]"
                data-kg-mobile-workspace-preview-lines="true"
              >
                {workspaceLines.length} lines
              </span>
            </div>
          </header>
          <section className="px-4 py-4">
            <div
              className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] px-4 py-4"
              data-kg-mobile-workspace-inline-host="true"
            >
              <MarkdownBlockContainer
                as="p"
                className="text-sm"
                highlightClass=""
                startLine={1}
                endLine={workspaceLines.length}
                inlineEditable
                sourceLines={workspaceLines}
                onReplaceLineRange={({ replacementLines }) => {
                  setWorkspaceLines(replacementLines.length > 0 ? replacementLines : [''])
                }}
                editPresentation="html"
                editHtmlRender="inline"
              >
                <span>{workspacePreview}</span>
              </MarkdownBlockContainer>
            </div>
          </section>
        </section>
      </section>
    </main>
  )
}
