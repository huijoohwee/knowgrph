import React from 'react'
import { FloatingPanelChatComposer } from '@/features/chat/floatingPanelChat/FloatingPanelChatComposer'
import { MarkdownBlockContainer } from '@/lib/markdown-core/ui/MarkdownBlockContainerCore.impl.engine.runtime'
import { MarkdownEditorPane } from '@/features/markdown-workspace/main/editor/MarkdownEditorPane'
import type { MonacoTextEditorHandle } from '@/features/monaco/MonacoTextEditor'
import { CanvasViewport } from '@/components/CanvasViewport'
import { MermaidVisibilityGate } from '@/features/markdown/ui/MermaidVisibilityGate'
import SerializationSection from '@/features/schema-editor/SerializationSection'

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

const MOBILE_SMOKE_WORKSPACE_EDITOR_LINES = [
  'Mobile editor smoke',
  '',
  'Keep the editor visible while the viewport shrinks.',
]

const MOBILE_SMOKE_WORKSPACE_JSON_LINES = [
  '{',
  '  "mode": "mobile-json-smoke",',
  '  "status": "fallback-first"',
  '}',
]

const mobileShellClassName =
  'mx-auto flex w-full max-w-[390px] flex-col rounded-[28px] border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] shadow-[0_20px_60px_rgba(15,23,42,0.18)]'

export function MobileKeyboardBrowserSmokePage() {
  const [chatInput, setChatInput] = React.useState('')
  const [streamCount, setStreamCount] = React.useState(6)
  const [chatProofStatus, setChatProofStatus] = React.useState('idle')
  const [workspaceLines, setWorkspaceLines] = React.useState(MOBILE_SMOKE_WORKSPACE_LINES)
  const [workspaceEditorText, setWorkspaceEditorText] = React.useState(MOBILE_SMOKE_WORKSPACE_EDITOR_LINES.join('\n'))
  const [workspaceJsonEditorText, setWorkspaceJsonEditorText] = React.useState(MOBILE_SMOKE_WORKSPACE_JSON_LINES.join('\n'))
  const [schemaSerializationPreview, setSchemaSerializationPreview] = React.useState('{}')
  const workspaceEditorRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const workspaceJsonEditorRef = React.useRef<MonacoTextEditorHandle | null>(null)
  const chatStreamRef = React.useRef<HTMLElement | null>(null)

  const streamItems = React.useMemo(
    () => Array.from({ length: streamCount }, (_, index) => ({
      id: `stream-${index + 1}`,
      text: `Streaming trace ${index + 1}: mobile-safe transcript line remains visible.`,
    })),
    [streamCount],
  )

  const workspacePreview = React.useMemo(() => workspaceLines.join('\n'), [workspaceLines])
  const handleChatRecovery = React.useCallback(() => {
    const latest = chatStreamRef.current?.querySelector('[data-kg-mobile-chat-stream-item]:last-child')
    if (latest instanceof HTMLElement) latest.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    setChatProofStatus(`recovered:${streamCount}`)
  }, [streamCount])
  const handleChatSubmit = React.useCallback(() => {
    const trimmed = chatInput.trim()
    setChatProofStatus(`submitted:${trimmed || 'empty'}`)
  }, [chatInput])

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
              ref={chatStreamRef as React.RefObject<HTMLElement>}
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
              <section className="mt-3 flex items-center justify-between gap-3">
                <output
                  className="min-w-0 truncate text-[11px] leading-5 text-[var(--kg-text-secondary)]"
                  data-kg-mobile-chat-proof-status="true"
                >
                  {chatProofStatus}
                </output>
                <section className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="App-toolbar__btn text-xs"
                    data-kg-mobile-chat-recovery-button="true"
                    onClick={handleChatRecovery}
                  >
                    Jump to latest
                  </button>
                  <button
                    type="button"
                    className="App-toolbar__btn text-xs"
                    data-kg-mobile-chat-submit-button="true"
                    onClick={handleChatSubmit}
                  >
                    Send
                  </button>
                </section>
              </section>
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
          <section className="px-4 pt-4">
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
          <section className="border-t border-[var(--kg-border)] px-4 py-4">
            <section className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Workspace markdown editor
              </h3>
              <span
                className="rounded-full border border-[var(--kg-border)] px-3 py-1 text-xs font-medium text-[var(--kg-text-secondary)]"
                data-kg-mobile-workspace-editor-lines="true"
              >
                {workspaceEditorText.split(/\r?\n/).length} lines
              </span>
            </section>
            <output
              className="mb-3 block whitespace-pre-wrap break-words rounded-xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--kg-text-secondary)]"
              data-kg-mobile-workspace-editor-preview="true"
            >
              {workspaceEditorText}
            </output>
            <div
              className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] overflow-hidden"
              data-kg-mobile-workspace-editor-host="true"
            >
              <MarkdownEditorPane
                value={workspaceEditorText}
                onChange={setWorkspaceEditorText}
                wordWrap={true}
                editorRef={workspaceEditorRef}
                panelTypography={{ panelTextClass: 'text-sm', panelMonospaceTextClass: 'font-mono text-xs' }}
                themeMode="dark"
                language="markdown"
                uri="file:///__smoke__/mobile-keyboard-editor.md"
                ariaLabel="Workspace Markdown Editor Text"
                paneAriaLabel="Workspace Markdown Editor"
              />
            </div>
          </section>
          <section className="border-t border-[var(--kg-border)] px-4 py-4">
            <section className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Workspace JSON editor
              </h3>
              <span
                className="rounded-full border border-[var(--kg-border)] px-3 py-1 text-xs font-medium text-[var(--kg-text-secondary)]"
                data-kg-mobile-workspace-json-editor-lines="true"
              >
                {workspaceJsonEditorText.split(/\r?\n/).length} lines
              </span>
            </section>
            <output
              className="mb-3 block whitespace-pre-wrap break-words rounded-xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--kg-text-secondary)]"
              data-kg-mobile-workspace-json-editor-preview="true"
            >
              {workspaceJsonEditorText}
            </output>
            <div
              className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] overflow-hidden"
              data-kg-mobile-workspace-json-editor-host="true"
            >
              <MarkdownEditorPane
                value={workspaceJsonEditorText}
                onChange={setWorkspaceJsonEditorText}
                wordWrap={true}
                editorRef={workspaceJsonEditorRef}
                panelTypography={{ panelTextClass: 'text-sm', panelMonospaceTextClass: 'font-mono text-xs' }}
                themeMode="dark"
                language="json"
                uri="file:///__smoke__/mobile-keyboard-editor.json"
                ariaLabel="Workspace JSON Editor Text"
                paneAriaLabel="Workspace JSON Editor"
              />
            </div>
          </section>
        </section>

        <section
          data-kg-mobile-keyboard-shell="runtime"
          className={mobileShellClassName}
          aria-label="Runtime mobile shell"
        >
          <header className="border-b border-[var(--kg-border)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Heavy runtime mobile shell</h2>
              <span className="rounded-full border border-[var(--kg-border)] px-3 py-1 text-xs font-medium text-[var(--kg-text-secondary)]">
                explicit intent
              </span>
            </div>
          </header>
          <section className="grid gap-4 px-4 py-4">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Canvas 3D gate
              </h3>
              <div
                className="h-[260px] overflow-hidden rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)]"
                data-kg-mobile-runtime-3d-host="true"
              >
                <CanvasViewport
                  variant="embeddedPreview"
                  layout="pane"
                  geospatialModeEnabled={false}
                  canvasRenderMode="3d"
                  canvas3dMode="3d"
                  canvas2dRenderer="d3"
                />
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Canvas map gate
              </h3>
              <div
                className="h-[260px] overflow-hidden rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)]"
                data-kg-mobile-runtime-geo-host="true"
              >
                <CanvasViewport
                  variant="embeddedPreview"
                  layout="pane"
                  geospatialModeEnabled
                  canvasRenderMode="2d"
                  canvas3dMode="3d"
                  canvas2dRenderer="d3"
                />
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Mermaid touch gate
              </h3>
              <div
                className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] px-4 py-4"
                data-kg-mobile-mermaid-gate-host="true"
              >
                <MermaidVisibilityGate>
                  <article
                    className="rounded-xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-3 text-sm"
                    data-kg-mobile-mermaid-runtime="true"
                  >
                    Mermaid runtime loaded after explicit touch activation.
                  </article>
                </MermaidVisibilityGate>
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kg-text-secondary)]">
                Schema serialization gate
              </h3>
              <output
                className="mb-3 block whitespace-pre-wrap break-words rounded-xl border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--kg-text-secondary)]"
                data-kg-mobile-schema-serialization-preview="true"
              >
                {schemaSerializationPreview}
              </output>
              <div
                className="rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-canvas-bg)] px-4 py-4"
                data-kg-mobile-schema-serialization-host="true"
              >
                <SerializationSection
                  uiPanelKeyValueTextSizeClass="text-xs"
                  uiPanelMonospaceTextClass="font-mono text-xs"
                  uiPanelMicroLabelTextSizeClass="text-[11px]"
                  defaultCollapsed={false}
                  setSerialization={patch => {
                    setSchemaSerializationPreview(JSON.stringify(patch, null, 2))
                  }}
                />
              </div>
            </section>
          </section>
        </section>
      </section>
    </main>
  )
}
