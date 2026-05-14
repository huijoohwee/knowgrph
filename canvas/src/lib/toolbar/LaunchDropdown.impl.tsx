import React from 'react'
import { BarChart3, CloudDownload, FolderOpen, FolderPlus, Globe, Link, Save, Sparkles, Upload, Download, Workflow } from 'lucide-react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { WORKSPACE_IMPORT_IMAGE_URL_TEST, WORKSPACE_IMPORT_URL_TEST } from '@/lib/config'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { cn } from '@/lib/utils'
import { WORKSPACE_EXPORT_MENU_ITEMS } from '@/lib/toolbar/exportMenuSsot'
import { ImportUrlPrompt } from '@/features/toolbar/ImportUrlPrompt'

const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')

type LaunchDropdownProps = {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  onClose: () => void
  onOpenWorkflowPanel: () => void
  onLaunchSpotlight?: () => void
  onLaunchStatus?: () => void
  onCloseMainPanel?: () => void
}

type LaunchDropdownFallbackModule = typeof import('@/features/toolbar/launchDropdownFallbacks')

let launchDropdownFallbackModulePromise: Promise<LaunchDropdownFallbackModule> | null = null

const loadLaunchDropdownFallbackModule = (): Promise<LaunchDropdownFallbackModule> => {
  if (!launchDropdownFallbackModulePromise) {
    launchDropdownFallbackModulePromise = import('@/features/toolbar/launchDropdownFallbacks')
      .then(mod => mod)
      .catch(err => {
        launchDropdownFallbackModulePromise = null
        throw err
      })
  }
  return launchDropdownFallbackModulePromise
}

export function LaunchDropdown({
  anchorRef,
  open,
  onClose,
  onOpenWorkflowPanel,
  onLaunchSpotlight,
  onLaunchStatus,
  onCloseMainPanel,
}: LaunchDropdownProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const folderInputRef = React.useRef<HTMLInputElement | null>(null)
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)
  const [urlDraft, setUrlDraft] = React.useState('')
  const [urlInputOpen, setUrlInputOpen] = React.useState(false)
  const [importUrlRenderer, setImportUrlRenderer] = React.useState<'default' | 'design'>('default')
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false)
  const [pdfMenuOpen, setPdfMenuOpen] = React.useState(false)
  const exportCloseTimeoutRef = React.useRef<number | null>(null)
  const pdfCloseTimeoutRef = React.useRef<number | null>(null)

  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const setCanvasRenderMode = useGraphStore(s => s.setCanvasRenderMode)
  const setCanvas2dRenderer = useGraphStore(s => s.setCanvas2dRenderer)
  const setFlowchartDataSource = useGraphStore(s => s.setFlowchartDataSource)

  const bridge = getMarkdownWorkspaceActionBridge()

  React.useEffect(() => {
    if (!open) return
    setUrlInputOpen(false)
    setImportUrlRenderer('default')
    setExportMenuOpen(false)
    setPdfMenuOpen(false)
    if (exportCloseTimeoutRef.current != null) {
      window.clearTimeout(exportCloseTimeoutRef.current)
      exportCloseTimeoutRef.current = null
    }
    if (pdfCloseTimeoutRef.current != null) {
      window.clearTimeout(pdfCloseTimeoutRef.current)
      pdfCloseTimeoutRef.current = null
    }
  }, [open])

  const openExportMenu = React.useCallback(() => {
    if (exportCloseTimeoutRef.current != null) {
      window.clearTimeout(exportCloseTimeoutRef.current)
      exportCloseTimeoutRef.current = null
    }
    setExportMenuOpen(true)
  }, [])

  const scheduleCloseExportMenu = React.useCallback(() => {
    if (exportCloseTimeoutRef.current != null) {
      window.clearTimeout(exportCloseTimeoutRef.current)
      exportCloseTimeoutRef.current = null
    }
    exportCloseTimeoutRef.current = window.setTimeout(() => {
      exportCloseTimeoutRef.current = null
      setExportMenuOpen(false)
    }, 180)
  }, [])

  const openPdfMenu = React.useCallback(() => {
    if (pdfCloseTimeoutRef.current != null) {
      window.clearTimeout(pdfCloseTimeoutRef.current)
      pdfCloseTimeoutRef.current = null
    }
    setPdfMenuOpen(true)
  }, [])

  const scheduleClosePdfMenu = React.useCallback(() => {
    if (pdfCloseTimeoutRef.current != null) {
      window.clearTimeout(pdfCloseTimeoutRef.current)
      pdfCloseTimeoutRef.current = null
    }
    pdfCloseTimeoutRef.current = window.setTimeout(() => {
      pdfCloseTimeoutRef.current = null
      setPdfMenuOpen(false)
    }, 180)
  }, [])

  React.useEffect(() => {
    if (!urlInputOpen) return
    const id = requestAnimationFrame(() => {
      try {
        urlInputRef.current?.focus()
      } catch {
        void 0
      }
    })
    return () => cancelAnimationFrame(id)
  }, [urlInputOpen])

  const openFilePicker = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    try {
      const anyEl = el as unknown as { showPicker?: () => void }
      if (typeof anyEl.showPicker === 'function') {
        anyEl.showPicker()
        return
      }
    } catch {
      void 0
    }
    try {
      el.click()
    } catch {
      void 0
    }
  }, [])

  const importLocalFilesFallback = React.useCallback(
    async (files: FileList | ReadonlyArray<File> | null) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importLocalFilesFallback({ files, pushUiToast })
    },
    [pushUiToast],
  )

  const importLocalFolderFallback = React.useCallback(
    async (files: FileList | ReadonlyArray<File> | null) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importLocalFolderFallback({ files, pushUiToast })
    },
    [pushUiToast],
  )

  const importUrlFallback = React.useCallback(
    async (urlRaw: string, opts?: { canvas2dRenderer?: 'design' | null }) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importUrlFallback({ urlRaw, canvas2dRenderer: opts?.canvas2dRenderer, pushUiToast })
    },
    [pushUiToast],
  )

  const importUrlDeerFlowFallback = React.useCallback(
    async (urlRaw: string, opts?: { canvas2dRenderer?: 'design' | null }) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importUrlDeerFlowFallback({ urlRaw, canvas2dRenderer: opts?.canvas2dRenderer, pushUiToast })
    },
    [pushUiToast],
  )

  const runImportUrl = React.useCallback(
    (nextUrlRaw: string) => {
      const nextUrl = String(nextUrlRaw || '').trim()
      if (!nextUrl) return
      onClose()
      const launchBridge = getMarkdownWorkspaceActionBridge()
      const canvas2dRenderer: 'design' | null = importUrlRenderer === 'design' ? 'design' : null
      const opts = canvas2dRenderer ? { canvas2dRenderer } : undefined
      if (typeof launchBridge.importUrl === 'function') launchBridge.importUrl(nextUrl, opts)
      else void importUrlFallback(nextUrl, opts)
      setUrlInputOpen(false)
    },
    [importUrlFallback, importUrlRenderer, onClose],
  )

  const runImportUrlDeerFlow = React.useCallback(
    (nextUrlRaw: string) => {
      const nextUrl = String(nextUrlRaw || '').trim()
      if (!nextUrl) return
      onClose()
      const canvas2dRenderer: 'design' | null = importUrlRenderer === 'design' ? 'design' : null
      const opts = canvas2dRenderer ? { canvas2dRenderer } : undefined
      void importUrlDeerFlowFallback(nextUrl, opts)
      setUrlInputOpen(false)
    },
    [importUrlDeerFlowFallback, importUrlRenderer, onClose],
  )

  const createNewFolderFallback = React.useCallback(async () => {
    const mod = await loadLaunchDropdownFallbackModule()
    await mod.createNewFolderFallback({ pushUiToast })
  }, [pushUiToast])

  const menuItemClass = cn(
    'kg-launch-menu-item w-full flex items-center gap-2 rounded text-sm',
    UI_THEME_TOKENS.text.primary,
    UI_THEME_TOKENS.button.hoverBg,
  )
  const menuIconClass = 'w-4 h-4'
  const menuRootClass = cn(
    'kg-launch-menu-root flex flex-col w-80 list-none m-0',
    UI_THEME_TOKENS.panel.bg,
    'border',
    UI_THEME_TOKENS.panel.border,
    'rounded shadow-md',
  )

  const fallbackExportActions = React.useMemo(
    () => ({
      htmlViewer: () => {
        void loadLaunchDropdownFallbackModule().then(mod => mod.exportHtmlViewerFallbackAction({ pushUiToast }))
      },
      htmlCanvas: () => {
        void loadLaunchDropdownFallbackModule().then(mod => mod.exportHtmlCanvasFallbackAction({ pushUiToast }))
      },
    }),
    [pushUiToast],
  )

  const exportActions = React.useMemo(() => ({ ...fallbackExportActions, ...(bridge.export || {}) }), [bridge.export, fallbackExportActions])
  const canExport = !!(
    exportActions?.duplicateInWorkspace ||
    exportActions?.workspaceFileJsonLd ||
    exportActions?.markdown ||
    exportActions?.png ||
    exportActions?.htmlViewer ||
    exportActions?.htmlCanvas ||
    exportActions?.json ||
    exportActions?.svg ||
    exportActions?.pdfPortrait ||
    exportActions?.pdfLandscape
  )

  const exportMenuClass = cn(
    'kg-launch-menu-root absolute left-full top-0 flex flex-col w-72 list-none m-0',
    UI_THEME_TOKENS.panel.bg,
    'border',
    UI_THEME_TOKENS.panel.border,
    'rounded shadow-md',
  )
  const pdfExportMenuClass = cn(
    'kg-launch-menu-root absolute left-full top-0 flex flex-col w-64 list-none m-0',
    UI_THEME_TOKENS.panel.bg,
    'border',
    UI_THEME_TOKENS.panel.border,
    'rounded shadow-md',
  )

  const runExportAction = React.useCallback(
    (label: string, action: (() => void) | undefined) => {
      if (typeof action !== 'function') {
        pushUiToast({ id: 'launch:export:missing', kind: 'warning', message: `${label}: open Workspace to export` })
        return
      }
      onClose()
      action()
    },
    [onClose, pushUiToast],
  )
  const nonPdfExportItems = React.useMemo(
    () => WORKSPACE_EXPORT_MENU_ITEMS.filter(item => item.id !== 'pdfPortrait' && item.id !== 'pdfLandscape'),
    [],
  )
  const canExportPdf = Boolean(exportActions?.pdfPortrait || exportActions?.pdfLandscape)

  return (
    <>
      <input
        ref={el => {
          fileInputRef.current = el
        }}
        type="file"
        className="sr-only"
        accept={WORKSPACE_IMPORT_ACCEPT}
        multiple
        onChange={e => {
          const files = e.target.files
          const launchBridge = getMarkdownWorkspaceActionBridge()
          if (typeof launchBridge.importLocalFiles === 'function') launchBridge.importLocalFiles(files)
          else void importLocalFilesFallback(files ? Array.from(files) : [])
          onClose()
          try {
            e.currentTarget.value = ''
          } catch {
            void 0
          }
        }}
      />

      <input
        ref={el => {
          folderInputRef.current = el
          if (!el) return
          try {
            el.setAttribute('webkitdirectory', '')
            el.setAttribute('directory', '')
          } catch {
            void 0
          }
        }}
        type="file"
        className="sr-only"
        multiple
        onChange={e => {
          const files = e.target.files
          const launchBridge = getMarkdownWorkspaceActionBridge()
          if (typeof launchBridge.importLocalFolder === 'function') launchBridge.importLocalFolder(files)
          else void importLocalFolderFallback(files ? Array.from(files) : [])
          onClose()
          try {
            e.currentTarget.value = ''
          } catch {
            void 0
          }
        }}
      />

      <DropdownPanel anchorRef={anchorRef} open={open} onClose={onClose} align="bottom-left">
        <menu className={menuRootClass} aria-label="Launch">
          {typeof onLaunchSpotlight === 'function' ? (
            <li className="list-none">
              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  onClose()
                  if (typeof onCloseMainPanel === 'function') onCloseMainPanel()
                  onLaunchSpotlight()
                }}
              >
                <Sparkles className={menuIconClass} strokeWidth={1.6} />
                <span className="truncate">Spotlight</span>
              </button>
            </li>
          ) : null}

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                onClose()
                try {
                  const state = useGraphStore.getState()
                  state.setStatusPanelPinned(false)
                  state.setEnableLaunchSpotlight(false)
                } catch {
                  void 0
                }
                onOpenWorkflowPanel()
              }}
            >
              <Workflow className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Workflow Manager</span>
            </button>
          </li>

          <li className={cn('my-1 border-t', UI_THEME_TOKENS.panel.divider)} aria-hidden="true" />

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                openFilePicker(fileInputRef.current)
              }}
            >
              <Upload className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Import local files</span>
            </button>
          </li>

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                onClose()
                setUrlInputOpen(false)
                setCanvasRenderMode('2d')
                setCanvas2dRenderer('flowchart')
                setFlowchartDataSource('api')
                pushUiToast({
                  id: 'launch:fetch-api-data-source',
                  kind: 'neutral',
                  message: 'Fetching API data source…',
                  ttlMs: 2500,
                })
              }}
            >
              <CloudDownload className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Fetch API Data Source</span>
            </button>
          </li>

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                openFilePicker(folderInputRef.current)
              }}
            >
              <FolderOpen className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Import folder</span>
            </button>
          </li>

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                const draft = String(urlDraft || '').trim()
                if (urlInputOpen) {
                  if (!draft) {
                    setUrlInputOpen(false)
                    return
                  }
                  runImportUrl(draft)
                  return
                }
                if (!draft) {
                  if (WORKSPACE_IMPORT_URL_TEST) {
                    setUrlDraft(WORKSPACE_IMPORT_URL_TEST)
                  } else if (WORKSPACE_IMPORT_IMAGE_URL_TEST) {
                    setUrlDraft(WORKSPACE_IMPORT_IMAGE_URL_TEST)
                  }
                }
                setUrlInputOpen(true)
              }}
            >
              <Link className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Import URL</span>
            </button>
            {urlInputOpen ? (
              <section className="mt-1">
                <ImportUrlPrompt
                  urlDraft={urlDraft}
                  onChange={setUrlDraft}
                  onCancel={() => setUrlInputOpen(false)}
                  autoFocus
                  confirmLabel="Import"
                  onConfirm={(next) => {
                    runImportUrl(next)
                  }}
                  rightAddon={
                    <section className="flex items-stretch gap-1">
                      <select
                        className={cn(
                          'h-[var(--kg-control-height,28px)] px-2 rounded border text-xs',
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.input.bg,
                          UI_THEME_TOKENS.input.text,
                        )}
                        value={importUrlRenderer}
                        onChange={e => setImportUrlRenderer(String(e.target.value || '').trim() === 'design' ? 'design' : 'default')}
                        aria-label="Import URL renderer"
                        title="2D renderer"
                      >
                        <option value="default">Default</option>
                        <option value="design">Design</option>
                      </select>
                      {typeof bridge.importWebsite === 'function' ? (
                        <button
                          type="button"
                          className={cn(
                            'h-[var(--kg-control-height,28px)] w-[var(--kg-control-height,28px)] inline-flex items-center justify-center rounded border',
                            UI_THEME_TOKENS.input.border,
                            UI_THEME_TOKENS.button.text,
                            UI_THEME_TOKENS.button.hoverBg,
                          )}
                          title="Import website (sitemap)"
                          aria-label="Import website"
                          onClick={() => {
                            const next = String(urlDraft || '').trim()
                            if (!next) return
                            onClose()
                            const launchBridge = getMarkdownWorkspaceActionBridge()
                            launchBridge.importWebsite?.(next)
                            setUrlInputOpen(false)
                          }}
                        >
                          <Globe className={menuIconClass} strokeWidth={1.6} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          'h-[var(--kg-control-height,28px)] w-[var(--kg-control-height,28px)] inline-flex items-center justify-center rounded border',
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.button.text,
                          UI_THEME_TOKENS.button.hoverBg,
                        )}
                        title="Import URL (DeerFlow)"
                        aria-label="Import URL (DeerFlow)"
                        onClick={() => {
                          const next = String(urlDraft || '').trim()
                          if (!next) return
                          runImportUrlDeerFlow(next)
                        }}
                      >
                        <Sparkles className={menuIconClass} strokeWidth={1.6} />
                      </button>
                    </section>
                  }
                />
              </section>
            ) : null}
          </li>

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                onClose()
                if (typeof bridge.createNewFolder === 'function') {
                  bridge.createNewFolder()
                  return
                }
                void createNewFolderFallback()
              }}
            >
              <FolderPlus className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">New folder</span>
            </button>
          </li>

          <li className="list-none">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => {
                if (typeof bridge.save !== 'function') return
                onClose()
                bridge.save()
              }}
              disabled={typeof bridge.save !== 'function'}
            >
              <Save className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Save</span>
            </button>
          </li>

          <li className={cn('my-1 border-t', UI_THEME_TOKENS.panel.divider)} aria-hidden="true" />

          <li className="list-none">
            <section className="relative" onPointerEnter={openExportMenu} onPointerLeave={scheduleCloseExportMenu}>
              <button
                type="button"
                className={menuItemClass}
                disabled={!canExport}
                onClick={() => {
                  if (!canExport) return
                  openExportMenu()
                }}
              >
                <Download className={menuIconClass} strokeWidth={1.6} />
                <span className="truncate">Export</span>
              </button>
              {exportMenuOpen ? (
                <menu className={exportMenuClass} aria-label="Export" onPointerEnter={openExportMenu} onPointerLeave={scheduleCloseExportMenu}>
                  {nonPdfExportItems.map(item => (
                    <li key={item.id} className="list-none">
                      <button
                        type="button"
                        className={menuItemClass}
                        onPointerDown={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          const action = (exportActions as unknown as Record<string, (() => void) | undefined>)?.[item.id]
                          runExportAction(item.toastLabel, action)
                        }}
                      >
                        <span className="truncate">{item.menuLabel}</span>
                      </button>
                    </li>
                  ))}
                  {canExportPdf ? (
                    <li className="list-none">
                      <section className="relative" onPointerEnter={openPdfMenu} onPointerLeave={scheduleClosePdfMenu}>
                        <button
                          type="button"
                          className={menuItemClass}
                          onClick={() => {
                            runExportAction('PDF Landscape', exportActions?.pdfLandscape || exportActions?.pdfPortrait)
                          }}
                        >
                          <span className="truncate">PDF (.pdf) — Print…</span>
                        </button>
                        {pdfMenuOpen ? (
                          <menu className={pdfExportMenuClass} aria-label="PDF export orientation" onPointerEnter={openPdfMenu} onPointerLeave={scheduleClosePdfMenu}>
                            <li className="list-none">
                              <button
                                type="button"
                                className={menuItemClass}
                                onClick={() => {
                                  runExportAction('PDF Portrait', exportActions?.pdfPortrait)
                                }}
                              >
                                <span className="truncate">Portrait 9:16</span>
                              </button>
                            </li>
                            <li className="list-none">
                              <button
                                type="button"
                                className={menuItemClass}
                                onClick={() => {
                                  runExportAction('PDF Landscape', exportActions?.pdfLandscape)
                                }}
                              >
                                <span className="truncate">Landscape 16:9</span>
                              </button>
                            </li>
                          </menu>
                        ) : null}
                      </section>
                    </li>
                  ) : null}
                </menu>
              ) : null}
            </section>
          </li>

          <li className={cn('my-1 border-t', UI_THEME_TOKENS.panel.divider)} aria-hidden="true" />

          {typeof onLaunchStatus === 'function' ? (
            <li className="list-none">
              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  onClose()
                  if (typeof onCloseMainPanel === 'function') onCloseMainPanel()
                  onLaunchStatus()
                }}
              >
                <BarChart3 className={menuIconClass} strokeWidth={1.6} />
                <span className="truncate">Status</span>
              </button>
            </li>
          ) : null}

          {!canExport ? (
            <li className={cn('px-2 py-1 text-xs', UI_THEME_TOKENS.text.tertiary)}>Exports available in Workspace</li>
          ) : null}
        </menu>
      </DropdownPanel>
    </>
  )
}
