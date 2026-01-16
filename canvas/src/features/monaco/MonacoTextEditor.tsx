import React from 'react'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

const FLASH_STYLE_ID = 'monaco-flash-style'
const FLASH_CSS = `
@keyframes monaco-flash-fade {
  0% { background-color: rgba(255, 215, 0, 0.4); }
  100% { background-color: transparent; }
}
.monaco-flash-line {
  animation: monaco-flash-fade var(--monaco-flash-duration, 1000ms) ease-out forwards;
}
`

export type MonacoTextEditorHandle = {
  focus: () => void
  revealLine: (line: number) => void
  revealOffsetInCenter: (offset: number) => void
  setSelection: (startLine: number, startColumn: number, endLine: number, endColumn: number) => void
  setSelectionOffsets: (startOffset: number, endOffset: number) => void
  getSelectionOffsets: () => { startOffset: number; endOffset: number } | null
  getValue: () => string
  setScrollTop: (scrollTop: number) => void
  getScrollTop: () => number
  getScrollHeight: () => number
  getClientHeight: () => number
  getLineHeight: () => number
  getContentWidth: () => number
  getVisibleRange: () => { startLine: number; endLine: number }
  getTopForLineNumber: (line: number) => number
  onDidScrollChange: (listener: (e: Monaco.IScrollEvent) => void) => Monaco.IDisposable
  onDidLayoutChange: (listener: (e: Monaco.editor.EditorLayoutInfo) => void) => Monaco.IDisposable
}

export type MonacoTextEditorProps = {
  value: string
  onChange: (next: string) => void
  language: string
  uri: string
  themeMode: 'light' | 'dark'
  wordWrap?: boolean
  readOnly?: boolean
  paddingTopPx?: number
  paddingBottomPx?: number
  className?: string
  onContextMenuSelection?: (args: { startLine: number; endLine: number; text: string; event: Monaco.editor.IEditorMouseEvent }) => void
  onContextMenu?: (args: { startLine: number; endLine: number; text?: string; event: Monaco.editor.IEditorMouseEvent }) => void
  onDoubleClickSelection?: (args: { startLine: number; endLine: number; text: string; event: Monaco.editor.IEditorMouseEvent }) => void
  onDoubleClickLine?: (line: number) => void
  onSelectionChangeOffsets?: (args: { startOffset: number; endOffset: number }) => void
  onDoubleClickSelectionOffsets?: (args: { startOffset: number; endOffset: number }) => void
  onScroll?: (scrollTop: number, scrollLeft: number) => void
  onBlur?: () => void
  onFocus?: () => void
  editorRef?: React.MutableRefObject<MonacoTextEditorHandle | null>
  flashLine?: number | null
  flashDurationMs?: number
}

type MonacoApi = typeof import('monaco-editor/esm/vs/editor/editor.api')

export function MonacoTextEditor(props: MonacoTextEditorProps) {
  const {
    value,
    onChange,
    language,
    uri,
    themeMode,
    wordWrap,
    readOnly,
    paddingTopPx,
    paddingBottomPx,
    className,
    onContextMenuSelection,
    onContextMenu,
    onDoubleClickSelection,
    onDoubleClickLine,
    onDoubleClickSelectionOffsets,
    onSelectionChangeOffsets,
    onScroll,
    editorRef,
    onBlur,
    onFocus,
    flashLine,
    flashDurationMs = 1000,
  } = props

  const hostRef = React.useRef<HTMLElement | null>(null)
  const textareaElRef = React.useRef<HTMLTextAreaElement | null>(null)
  const monacoRef = React.useRef<MonacoApi | null>(null)
  const editorInstanceRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = React.useRef<string[]>([])
  const lastAppliedValueRef = React.useRef<string>(value)
  const editorRefRef = React.useRef(editorRef)
  const onChangeRef = React.useRef(onChange)
  const onContextMenuSelectionRef = React.useRef(onContextMenuSelection)
  const onContextMenuRef = React.useRef(onContextMenu)
  const onDoubleClickSelectionRef = React.useRef(onDoubleClickSelection)
  const onDoubleClickLineRef = React.useRef(onDoubleClickLine)
  const onDoubleClickSelectionOffsetsRef = React.useRef(onDoubleClickSelectionOffsets)
  const onSelectionChangeOffsetsRef = React.useRef(onSelectionChangeOffsets)
  const onScrollRef = React.useRef(onScroll)
  const onBlurRef = React.useRef(onBlur)
  const onFocusRef = React.useRef(onFocus)
  const textareaHandleRef = React.useRef<MonacoTextEditorHandle | null>(null)

  React.useEffect(() => {
    editorRefRef.current = editorRef
    onChangeRef.current = onChange
    onContextMenuSelectionRef.current = onContextMenuSelection
    onContextMenuRef.current = onContextMenu
    onDoubleClickSelectionRef.current = onDoubleClickSelection
    onDoubleClickLineRef.current = onDoubleClickLine
    onDoubleClickSelectionOffsetsRef.current = onDoubleClickSelectionOffsets
    onSelectionChangeOffsetsRef.current = onSelectionChangeOffsets
    onScrollRef.current = onScroll
    onBlurRef.current = onBlur
    onFocusRef.current = onFocus
  }, [editorRef, onChange, onContextMenuSelection, onContextMenu, onDoubleClickSelection, onDoubleClickLine, onDoubleClickSelectionOffsets, onSelectionChangeOffsets, onScroll, onBlur, onFocus])

  React.useEffect(() => {
    if (editorInstanceRef.current) return
    if (document.getElementById(FLASH_STYLE_ID)) return
    const styleEl = document.createElement('style')
    styleEl.id = FLASH_STYLE_ID
    styleEl.textContent = FLASH_CSS
    document.head.appendChild(styleEl)
  }, [])

  React.useEffect(() => {
    const editor = editorInstanceRef.current
    const monaco = monacoRef.current
    const host = hostRef.current
    if (!editor || !monaco || !flashLine || !host) return

    host.style.setProperty('--monaco-flash-duration', `${flashDurationMs}ms`)

    editor.revealLineInCenter(flashLine)
    
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(flashLine, 1, flashLine, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-flash-line',
        },
      },
    ]

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)

    const timer = setTimeout(() => {
        // Fade out or remove? Monaco doesn't support CSS transitions on decorations easily unless class changes.
        // We can just remove it after a delay.
        if (editorInstanceRef.current) {
            decorationsRef.current = editorInstanceRef.current.deltaDecorations(decorationsRef.current, [])
        }
    }, flashDurationMs) // Dynamic flash

    return () => clearTimeout(timer)
  }, [flashLine, flashDurationMs])

  React.useEffect(() => {
    if (editorInstanceRef.current && monacoRef.current) {
        monacoRef.current.editor.setTheme(themeMode === 'dark' ? 'vs-dark' : 'vs')
    }
  }, [themeMode])

  const isJsdom =
    typeof window !== 'undefined' &&
    typeof window.navigator !== 'undefined' &&
    /jsdom/i.test(String(window.navigator.userAgent || ''))

  const canUseMonaco =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof (window as unknown as { Worker?: unknown }).Worker !== 'undefined' &&
    !isJsdom

  React.useEffect(() => {
    if (canUseMonaco) return
    const editorRefNow = editorRefRef.current
    if (!editorRefNow) return
    if (!textareaElRef.current) {
      editorRefNow.current = null
      textareaHandleRef.current = null
      return
    }
    editorRefNow.current = textareaHandleRef.current
    return () => {
      const current = editorRefRef.current
      if (current) current.current = null
      textareaHandleRef.current = null
    }
  }, [canUseMonaco])

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (!canUseMonaco) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    const start = async () => {
      const monaco = await import('monaco-editor/esm/vs/editor/editor.api')
      await import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution')
      const { ensureMonacoEnvironment } = await import('./monacoEnvironment')
      const { acquireTextModel } = await import('./monacoModelRegistry')
      await import('monaco-editor/esm/vs/editor/contrib/stickyScroll/browser/stickyScrollContribution')
      if (cancelled) return

      ensureMonacoEnvironment()
      monacoRef.current = monaco

      const src = String(uri || '').trim()
      const monacoUri = (() => {
        if (!src) return monaco.Uri.parse('inmemory://model/empty')
        if (src.startsWith('inmemory://') || src.startsWith('file://')) return monaco.Uri.parse(src)
        return monaco.Uri.parse(`file://${src.replace(/^\/+/, '/')}`)
      })()

      const { model, release } = acquireTextModel(monaco, {
        uri: monacoUri,
        language,
        value: lastAppliedValueRef.current,
      })

      const editor = monaco.editor.create(host, {
        model,
        readOnly: !!readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: wordWrap ? 'on' : 'off',
        fontLigatures: false,
        automaticLayout: true,
        contextmenu: true,
        padding: {
          top:
            typeof paddingTopPx === 'number' && Number.isFinite(paddingTopPx) && paddingTopPx > 0
              ? Math.floor(paddingTopPx)
              : 0,
          bottom:
            typeof paddingBottomPx === 'number' && Number.isFinite(paddingBottomPx) && paddingBottomPx > 0
              ? Math.floor(paddingBottomPx)
              : 0,
        },
        stickyScroll: {
          enabled: true,
          maxLineCount: 5,
        },
      })

      editorInstanceRef.current = editor
      lastAppliedValueRef.current = model.getValue()

      const handle = {
        focus: () => editor.focus(),
        revealLine: (line: number) => {
          const safe = Math.max(1, Math.floor(line || 1))
          editor.revealLineInCenter(safe)
        },
        revealOffsetInCenter: (offset: number) => {
          const model = editor.getModel()
          if (!model) return
          const safe = Math.max(0, Math.floor(offset || 0))
          const pos = model.getPositionAt(safe)
          editor.revealPositionInCenter(pos)
        },
        setSelection: (startLine: number, startColumn: number, endLine: number, endColumn: number) => {
          editor.setSelection(
            new monaco.Range(
              Math.max(1, startLine),
              Math.max(1, startColumn),
              Math.max(1, endLine),
              Math.max(1, endColumn),
            ),
          )
        },
        setSelectionOffsets: (startOffset: number, endOffset: number) => {
          const model = editor.getModel()
          if (!model) return
          const start = Math.max(0, Math.floor(startOffset || 0))
          const end = Math.max(0, Math.floor(endOffset || 0))
          const startPos = model.getPositionAt(start)
          const endPos = model.getPositionAt(end)
          editor.setSelection(new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column))
        },
        getSelectionOffsets: () => {
          const model = editor.getModel()
          if (!model) return null
          const sel = editor.getSelection()
          if (!sel) return null
          const startOffset = model.getOffsetAt({ lineNumber: sel.startLineNumber, column: sel.startColumn })
          const endOffset = model.getOffsetAt({ lineNumber: sel.endLineNumber, column: sel.endColumn })
          return { startOffset, endOffset }
        },
        getValue: () => editor.getModel()?.getValue() || '',
        setScrollTop: (scrollTop: number) => editor.setScrollTop(scrollTop),
        getScrollTop: () => editor.getScrollTop(),
        getScrollHeight: () => editor.getScrollHeight(),
        getClientHeight: () => editor.getLayoutInfo().height,
        getLineHeight: () => editor.getOption(monaco.editor.EditorOption.lineHeight),
        getContentWidth: () => editor.getLayoutInfo().contentWidth,
        getVisibleRange: () => {
          const ranges = editor.getVisibleRanges()
          if (!ranges.length) return { startLine: 1, endLine: 1 }
          return {
            startLine: ranges[0].startLineNumber,
            endLine: ranges[ranges.length - 1].endLineNumber,
          }
        },
        getTopForLineNumber: (line) => {
          const safe = Math.max(1, Math.min(line, editor.getModel()?.getLineCount() || 1))
          return editor.getTopForLineNumber(safe)
        },
        onDidScrollChange: (listener) => editor.onDidScrollChange(listener),
        onDidLayoutChange: (listener) => editor.onDidLayoutChange(listener),
      } satisfies MonacoTextEditorHandle

      const editorRefNow = editorRefRef.current
      if (editorRefNow) editorRefNow.current = handle

      const contentSub = model.onDidChangeContent(() => {
        const next = model.getValue()
        lastAppliedValueRef.current = next
        onChangeRef.current(next)
      })

      const contextSub =
        editor.onContextMenu((e) => {
            const model = editor.getModel()
            if (!model) return
            
            // Try to get selection first
            const sel = editor.getSelection()
            let startLine = 0
            let endLine = 0
            let text = ''
            
            if (sel && !sel.isEmpty()) {
                startLine = Math.min(sel.startLineNumber, sel.endLineNumber)
                endLine = Math.max(sel.startLineNumber, sel.endLineNumber)
                text = model.getValueInRange(sel)
                
                if (onContextMenuSelectionRef.current) {
                  onContextMenuSelectionRef.current({ startLine, endLine, text, event: e })
                }
            } else if (e.target && e.target.position) {
                // No selection, use cursor position from event
                startLine = e.target.position.lineNumber
                endLine = e.target.position.lineNumber
            }

            if (onContextMenuRef.current) {
                onContextMenuRef.current({ startLine, endLine, text: text || undefined, event: e })
            }
          })

      const dblSub =
        editor.onMouseDown(e => {
          // Standard Monaco behavior for double click is selecting a word.
          // We don't want to prevent that, but we want to hook into it.
          // However, if we are having issues with selection, let's be careful.
          if (e.event.detail !== 2) return
          
          const p = e.target.position
          if (!p) return
          
          if (onDoubleClickLineRef.current) {
            onDoubleClickLineRef.current(p.lineNumber)
          }

          if (onDoubleClickSelectionRef.current) {
            // Queue to let Monaco finish its internal selection logic
            setTimeout(() => {
                if (!editorInstanceRef.current) return
                const model = editor.getModel()
                if (!model) return
                const sel = editor.getSelection()
                if (!sel) return
                const startLine = Math.min(sel.startLineNumber, sel.endLineNumber)
                const endLine = Math.max(sel.startLineNumber, sel.endLineNumber)
                const text = model.getValueInRange(sel)
                // Only trigger if we actually have a selection
                if (text && text.length > 0 && onDoubleClickSelectionRef.current) {
                    onDoubleClickSelectionRef.current({ startLine, endLine, text, event: e })
                }
            }, 0)
          }
        })
      
      const dblSelSub =
        editor.onMouseDown(e => {
            if (e.event.detail !== 2) return
            queueMicrotask(() => {
              const offsets = handle.getSelectionOffsets()
              if (!offsets) return
              if (onDoubleClickSelectionOffsetsRef.current) {
                onDoubleClickSelectionOffsetsRef.current(offsets)
              }
            })
          })

      const selSub =
        editor.onDidChangeCursorSelection(() => {
          const offsets = handle.getSelectionOffsets()
          if (!offsets) return
          if (onSelectionChangeOffsetsRef.current) {
            onSelectionChangeOffsetsRef.current(offsets)
          }
        })
      
      const blurSub = editor.onDidBlurEditorWidget(() => {
        if (onBlurRef.current) onBlurRef.current()
      })

      const focusSub = editor.onDidFocusEditorText(() => {
        if (onFocusRef.current) onFocusRef.current()
      })

      cleanup = () => {
        contentSub.dispose()
        if (contextSub) contextSub.dispose()
        if (dblSub) dblSub.dispose()
        if (dblSelSub) dblSelSub.dispose()
        if (selSub) selSub.dispose()
        if (blurSub) blurSub.dispose()
        if (focusSub) focusSub.dispose()
        const editorRefNow = editorRefRef.current
        if (editorRefNow) editorRefNow.current = null
        editorInstanceRef.current = null
        editor.dispose()
        release()
      }
    }

    void start()

    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [
    canUseMonaco,
    language,
    readOnly,
    uri,
    wordWrap,
    paddingTopPx,
    paddingBottomPx,
  ])

  React.useEffect(() => {
    if (!canUseMonaco) return
    const editor = editorInstanceRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const current = model.getValue()
    if (value === current) return
    if (value === lastAppliedValueRef.current) return
    const viewState = editor.saveViewState()
    model.setValue(value)
    lastAppliedValueRef.current = value
    if (viewState) {
      editor.restoreViewState(viewState)
    }
  }, [canUseMonaco, value])

  React.useEffect(() => {
    if (!canUseMonaco) return
    const monaco = monacoRef.current
    if (!monaco) return
    monaco.editor.setTheme(themeMode === 'dark' ? 'vs-dark' : 'vs')
  }, [canUseMonaco, themeMode])

  return (
    <section className={canUseMonaco ? className : undefined}>
      {canUseMonaco ? (
        <section
          ref={el => {
            hostRef.current = el
          }}
          className={['h-full w-full', UI_THEME_TOKENS.input.bg].join(' ')}
        />
      ) : (
        <textarea
          ref={el => {
            textareaElRef.current = el
            const editorRefNow = editorRefRef.current
            if (!editorRefNow) return
            if (!el) {
              editorRefNow.current = null
              textareaHandleRef.current = null
              return
            }

            const readLineHeight = () => {
              try {
                const cs = window.getComputedStyle(el)
                const raw = cs.lineHeight ? Number.parseFloat(cs.lineHeight) : NaN
                return Number.isFinite(raw) && raw > 0 ? raw : 16
              } catch {
                return 16
              }
            }

            const splitLines = () => String(el.value || '').split('\n')

            const getOffsetAt = (line: number, column: number) => {
              const lines = splitLines()
              const safeLine = Math.max(1, Math.min(Math.floor(line || 1), lines.length || 1))
              const safeCol = Math.max(1, Math.floor(column || 1))
              let offset = 0
              for (let i = 0; i < safeLine - 1; i += 1) {
                offset += lines[i].length + 1
              }
              const lineText = lines[safeLine - 1] ?? ''
              const colZeroBased = Math.min(safeCol - 1, lineText.length)
              return offset + colZeroBased
            }

            const getLineForOffset = (offset: number) => {
              const safeOffset = Math.max(0, Math.floor(offset || 0))
              const lines = splitLines()
              let cursor = 0
              for (let i = 0; i < lines.length; i += 1) {
                const len = lines[i].length
                const end = cursor + len
                if (safeOffset <= end) return i + 1
                cursor = end + 1
              }
              return Math.max(1, lines.length)
            }

            const getTopForLineNumber = (line: number) => {
              const lh = readLineHeight()
              const safe = Math.max(1, Math.floor(line || 1))
              return (safe - 1) * lh
            }

            const handle: MonacoTextEditorHandle = {
              focus: () => el.focus(),
              revealLine: (line: number) => {
                const top = getTopForLineNumber(line)
                el.scrollTop = top
              },
              revealOffsetInCenter: (offset: number) => {
                const line = getLineForOffset(offset)
                const top = getTopForLineNumber(line)
                el.scrollTop = Math.max(0, top - el.clientHeight / 2)
              },
              setSelection: (startLine, startColumn, endLine, endColumn) => {
                const start = getOffsetAt(startLine, startColumn)
                const end = getOffsetAt(endLine, endColumn)
                el.selectionStart = Math.min(start, end)
                el.selectionEnd = Math.max(start, end)
              },
              setSelectionOffsets: (startOffset: number, endOffset: number) => {
                const start = Math.max(0, Math.floor(startOffset || 0))
                const end = Math.max(0, Math.floor(endOffset || 0))
                el.selectionStart = Math.min(start, end)
                el.selectionEnd = Math.max(start, end)
              },
              getSelectionOffsets: () => {
                const startOffset = typeof el.selectionStart === 'number' ? el.selectionStart : null
                const endOffset = typeof el.selectionEnd === 'number' ? el.selectionEnd : null
                if (startOffset == null || endOffset == null) return null
                return { startOffset, endOffset }
              },
              getValue: () => String(el.value || ''),
              setScrollTop: (scrollTop: number) => {
                el.scrollTop = Math.max(0, Math.floor(scrollTop || 0))
              },
              getScrollTop: () => el.scrollTop,
              getScrollHeight: () => el.scrollHeight,
              getClientHeight: () => el.clientHeight,
              getLineHeight: () => readLineHeight(),
              getContentWidth: () => el.clientWidth,
              getVisibleRange: () => {
                const lh = readLineHeight()
                const totalLines = splitLines().length || 1
                const startLine = Math.max(1, Math.min(totalLines, Math.floor(el.scrollTop / lh) + 1))
                const endLine = Math.max(
                  startLine,
                  Math.min(totalLines, Math.floor((el.scrollTop + el.clientHeight) / lh) + 1),
                )
                return { startLine, endLine }
              },
              getTopForLineNumber,
              onDidScrollChange: (listener) => {
                const handler = () => {
                  const ev = {
                    scrollTop: el.scrollTop,
                    scrollLeft: el.scrollLeft,
                    scrollHeight: el.scrollHeight,
                    scrollWidth: el.scrollWidth,
                    scrollTopChanged: true,
                    scrollLeftChanged: false,
                    scrollWidthChanged: false,
                    scrollHeightChanged: false,
                  } as unknown as Monaco.IScrollEvent
                  listener(ev)
                }
                el.addEventListener('scroll', handler)
                return {
                  dispose: () => el.removeEventListener('scroll', handler),
                }
              },
              onDidLayoutChange: (listener) => {
                const handler = () => {
                  const info = {
                    width: el.clientWidth,
                    height: el.clientHeight,
                  } as unknown as Monaco.editor.EditorLayoutInfo
                  listener(info)
                }
                let ro: ResizeObserver | null = null
                if (typeof window !== 'undefined' && typeof (window as unknown as { ResizeObserver?: unknown }).ResizeObserver !== 'undefined') {
                  ro = new ResizeObserver(() => handler())
                  ro.observe(el)
                } else {
                  window.addEventListener('resize', handler)
                }
                return {
                  dispose: () => {
                    if (ro) ro.disconnect()
                    window.removeEventListener('resize', handler)
                  },
                }
              },
            }

            textareaHandleRef.current = handle
            editorRefNow.current = handle
          }}
          value={value}
          readOnly={!!readOnly}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          className={[
            'h-full w-full resize-none outline-none p-2',
            UI_THEME_TOKENS.input.bg,
            UI_THEME_TOKENS.input.text,
            className || '',
          ].join(' ')}
        />
      )}
    </section>
  )
}
