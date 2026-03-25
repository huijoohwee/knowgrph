import React from 'react'
import { BarChart3, FolderOpen, FolderPlus, Globe, Link, Save, Sparkles, Upload, Download, Workflow } from 'lucide-react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SOURCE_FILES_COPY, SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { WORKSPACE_IMPORT_IMAGE_URL_TEST, WORKSPACE_IMPORT_URL_TEST } from '@/lib/config'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { cn } from '@/lib/utils'
import { exportHtmlCanvasFallback, exportHtmlViewerFallback } from './exportHtmlFallback'

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
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false)
  const exportCloseTimeoutRef = React.useRef<number | null>(null)

  const pushUiToast = useGraphStore(s => s.pushUiToast)

  const bridge = getMarkdownWorkspaceActionBridge()

  React.useEffect(() => {
    if (!open) return
    setUrlInputOpen(false)
    setExportMenuOpen(false)
    if (exportCloseTimeoutRef.current != null) {
      window.clearTimeout(exportCloseTimeoutRef.current)
      exportCloseTimeoutRef.current = null
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
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      pushUiToast({ id: 'launch:import:localFiles', kind: 'neutral', message: `Importing ${snapshot.length} file(s)…`, ttlMs: null, dismissible: false })
      try {
        const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceLocalFiles }] =
          await Promise.all([
            import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
            import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
            import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
            import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
            import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')>,
          ])
        const fs = await getWorkspaceFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceLocalFiles({
            fs,
            files: snapshot,
            parentPath: WORKSPACE_ROOT_PATH,
          }),
        )
        bulkSetWorkspaceEntrySources(res.sources)
        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths })
        } catch {
          void 0
        }
        pushUiToast({ id: 'launch:import:localFiles', kind: 'success', message: `Imported ${res.createdPaths.length} file(s)`, ttlMs: 2200, dismissible: false })
      } catch (e) {
        pushUiToast({ id: 'launch:import:localFiles', kind: 'error', message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`, ttlMs: 6000, dismissible: true })
      }
    },
    [pushUiToast],
  )

  const importLocalFolderFallback = React.useCallback(
    async (files: FileList | null) => {
      const snapshot = files ? Array.from(files) : []
      if (snapshot.length === 0) return
      pushUiToast({ id: 'launch:import:folder', kind: 'neutral', message: `Importing folder…`, ttlMs: null, dismissible: false })
      try {
        const [{ getWorkspaceFs }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceLocalFolder }] = await Promise.all([
          import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
          import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
          import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
          import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')>,
        ])
        const fs = await getWorkspaceFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() => importWorkspaceLocalFolder({ fs, files: snapshot }))
        bulkSetWorkspaceEntrySources(res.sources)
        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths })
        } catch {
          void 0
        }
        pushUiToast({ id: 'launch:import:folder', kind: 'success', message: `Imported ${res.createdPaths.length} file(s)`, ttlMs: 2200, dismissible: false })
      } catch (e) {
        pushUiToast({ id: 'launch:import:folder', kind: 'error', message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`, ttlMs: 6000, dismissible: true })
      }
    },
    [pushUiToast],
  )

  const importUrlFallback = React.useCallback(
    async (urlRaw: string) => {
      const url = String(urlRaw || '').trim()
      if (!url) return
      const toastId = 'launch:import:url'
      pushUiToast({ id: toastId, kind: 'neutral', message: 'Importing URL…', ttlMs: null, dismissible: false })
      try {
        const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }, { runWorkspaceFsChangedBatch }, { bulkSetWorkspaceEntrySources }, { importWorkspaceUrl }] = await Promise.all([
          import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
          import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
          import('@/features/workspace-fs/workspaceFsEvents') as Promise<typeof import('@/features/workspace-fs/workspaceFsEvents')>,
          import('@/features/workspace-fs/sourceIndex') as Promise<typeof import('@/features/workspace-fs/sourceIndex')>,
          import('@/components/BottomPanel/markdownWorkspace/workspaceImport') as Promise<typeof import('@/components/BottomPanel/markdownWorkspace/workspaceImport')>,
        ])
        const fs = await getWorkspaceFs()
        await fs.ensureSeed()
        const res = await runWorkspaceFsChangedBatch(() =>
          importWorkspaceUrl({
            fs,
            urlRaw: url,
            parentPath: WORKSPACE_ROOT_PATH,
            onProgress: p => {
              const label = String((p as { label?: unknown }).label || '').trim() || 'Importing URL…'
              pushUiToast({ id: toastId, kind: 'neutral', message: label, ttlMs: null, dismissible: false })
            },
          }),
        )
        bulkSetWorkspaceEntrySources(res.sources)
        try {
          const { applyWorkspaceImportToCanvas } = (await import('@/features/workspace-fs/applyWorkspaceImportToCanvas')) as typeof import(
            '@/features/workspace-fs/applyWorkspaceImportToCanvas'
          )
          await applyWorkspaceImportToCanvas({ fs, createdPaths: res.createdPaths })
        } catch {
          void 0
        }
        pushUiToast({ id: toastId, kind: 'success', message: `Imported ${res.createdPaths.length} file(s)`, ttlMs: 2200, dismissible: false })
      } catch (e) {
        pushUiToast({ id: toastId, kind: 'error', message: `Import failed: ${String((e as { message?: unknown })?.message ?? e)}`, ttlMs: 6000, dismissible: true })
      }
    },
    [pushUiToast],
  )

  const createNewFolderFallback = React.useCallback(async () => {
    const toastId = 'launch:workspace:newFolder'
    pushUiToast({ id: toastId, kind: 'neutral', message: 'Creating folder…', ttlMs: null, dismissible: false })
    try {
      const [{ getWorkspaceFs }, { WORKSPACE_ROOT_PATH }] = await Promise.all([
        import('@/features/workspace-fs/workspaceFs') as Promise<typeof import('@/features/workspace-fs/workspaceFs')>,
        import('@/features/workspace-fs/path') as Promise<typeof import('@/features/workspace-fs/path')>,
      ])
      const fs = await getWorkspaceFs()
      await fs.ensureSeed()
      await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'folder' })
      pushUiToast({ id: toastId, kind: 'success', message: 'Created folder', ttlMs: 1800, dismissible: false })
    } catch (e) {
      pushUiToast({ id: toastId, kind: 'error', message: `Failed: ${String((e as { message?: unknown })?.message ?? e)}`, ttlMs: 6000, dismissible: true })
    }
  }, [pushUiToast])

  const menuItemClass = cn(
    'w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm',
    UI_THEME_TOKENS.text.primary,
    UI_THEME_TOKENS.button.hoverBg,
  )
  const menuIconClass = 'w-4 h-4'
  const menuRootClass = cn(
    'p-1 flex flex-col gap-1 w-80 list-none m-0',
    UI_THEME_TOKENS.panel.bg,
    'border',
    UI_THEME_TOKENS.panel.border,
    'rounded shadow-md',
  )

  const fallbackExportActions = React.useMemo(
    () => ({
      htmlViewer: () => {
        void exportHtmlViewerFallback({ pushUiToast })
      },
      htmlCanvas: () => {
        void exportHtmlCanvasFallback({ pushUiToast })
      },
    }),
    [pushUiToast],
  )

  const exportActions = React.useMemo(() => ({ ...fallbackExportActions, ...(bridge.export || {}) }), [bridge.export, fallbackExportActions])
  const canExport = !!(
    exportActions?.duplicateInWorkspace ||
    exportActions?.workspaceFileJsonLd ||
    exportActions?.markdown ||
    exportActions?.htmlViewer ||
    exportActions?.htmlCanvas ||
    exportActions?.json ||
    exportActions?.svg ||
    exportActions?.pdf
  )

  const exportMenuClass = cn(
    'absolute left-full top-0 p-1 flex flex-col gap-1 w-72 list-none m-0',
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
          if (typeof bridge.importLocalFiles === 'function') bridge.importLocalFiles(files)
          else void importLocalFilesFallback(files)
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
          if (typeof bridge.importLocalFolder === 'function') bridge.importLocalFolder(files)
          else void importLocalFolderFallback(files)
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
                onClose()
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
                openFilePicker(folderInputRef.current)
                onClose()
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
                  onClose()
                  if (typeof bridge.importUrl === 'function') bridge.importUrl(draft)
                  else void importUrlFallback(draft)
                  setUrlInputOpen(false)
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
              <section className="mt-1" aria-label="URL import controls">
                {(WORKSPACE_IMPORT_URL_TEST || WORKSPACE_IMPORT_IMAGE_URL_TEST) && (
                  <section className="mb-1 flex items-center gap-1">
                    {WORKSPACE_IMPORT_URL_TEST ? (
                      <button
                        type="button"
                        className={cn(
                          'h-6 px-2 inline-flex items-center justify-center rounded border text-xs',
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.button.text,
                          UI_THEME_TOKENS.button.hoverBg,
                        )}
                        onClick={() => setUrlDraft(WORKSPACE_IMPORT_URL_TEST)}
                      >
                        Test URL
                      </button>
                    ) : null}
                    {WORKSPACE_IMPORT_IMAGE_URL_TEST ? (
                      <button
                        type="button"
                        className={cn(
                          'h-6 px-2 inline-flex items-center justify-center rounded border text-xs',
                          UI_THEME_TOKENS.input.border,
                          UI_THEME_TOKENS.button.text,
                          UI_THEME_TOKENS.button.hoverBg,
                        )}
                        onClick={() => setUrlDraft(WORKSPACE_IMPORT_IMAGE_URL_TEST)}
                      >
                        Test image
                      </button>
                    ) : null}
                  </section>
                )}

                <section className="flex items-stretch gap-1">
                  <input
                    ref={urlInputRef}
                    className={cn(
                      'flex-1 min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border box-border text-xs',
                      UI_THEME_TOKENS.input.border,
                      UI_THEME_TOKENS.input.bg,
                      UI_THEME_TOKENS.input.text,
                    )}
                    placeholder={SOURCE_FILES_COPY.urlPlaceholder}
                    value={urlDraft}
                    onChange={e => setUrlDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setUrlInputOpen(false)
                        return
                      }
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const next = String(urlDraft || '').trim()
                      if (!next) return
                      onClose()
                      if (typeof bridge.importUrl === 'function') bridge.importUrl(next)
                      else void importUrlFallback(next)
                      setUrlInputOpen(false)
                    }}
                  />
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
                        bridge.importWebsite?.(next)
                        setUrlInputOpen(false)
                      }}
                    >
                      <Globe className={menuIconClass} strokeWidth={1.6} />
                    </button>
                  ) : null}
                </section>
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
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('Duplicate in workspace', exportActions?.duplicateInWorkspace)
                      }}
                    >
                      <span className="truncate">Duplicate in workspace</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('Workspace file', exportActions?.workspaceFileJsonLd)
                      }}
                    >
                      <span className="truncate">Workspace file (.jsonld)</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('Markdown', exportActions?.markdown)
                      }}
                    >
                      <span className="truncate">Markdown (.md)</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('HTML Viewer', exportActions?.htmlViewer)
                      }}
                    >
                      <span className="truncate">HTML (.html) — Viewer</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('HTML Canvas', exportActions?.htmlCanvas)
                      }}
                    >
                      <span className="truncate">HTML (.html) — Canvas</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('JSON', exportActions?.json)
                      }}
                    >
                      <span className="truncate">JSON (.json)</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('SVG', exportActions?.svg)
                      }}
                    >
                      <span className="truncate">SVG (.svg)</span>
                    </button>
                  </li>
                  <li className="list-none">
                    <button
                      type="button"
                      className={menuItemClass}
                      onPointerDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        runExportAction('PDF', exportActions?.pdf)
                      }}
                    >
                      <span className="truncate">PDF (Print…)</span>
                    </button>
                  </li>
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
