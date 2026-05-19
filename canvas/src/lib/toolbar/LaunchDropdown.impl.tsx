import React from 'react'
import { BarChart3, ChevronDown, CloudDownload, FolderOpen, FolderPlus, Globe, Link, Save, Sparkles, Upload, Workflow } from 'lucide-react'
import { DropdownPanel } from '@/lib/ui/overlay'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { WORKSPACE_IMPORT_IMAGE_URL_TEST, WORKSPACE_IMPORT_URL_TEST } from '@/lib/config'
import { getMarkdownWorkspaceActionBridge } from '@/features/markdown-explorer/workspaceActionBridge'
import { useGraphStore } from '@/hooks/useGraphStore'
import { cn } from '@/lib/utils'
import { UI_RESPONSIVE_LAUNCH_MENU_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { ImportUrlPrompt } from '@/features/toolbar/ImportUrlPrompt'
import {
  type WorkspaceUrlImportCanvasRendererId,
  type WorkspaceUrlImportDocumentModeId,
} from '@/features/markdown-workspace/workspaceImport/canvasPresets'
import {
  LaunchDropdownExportMenu,
  hasLaunchDropdownExportActions,
  type LaunchDropdownExportActions,
} from './LaunchDropdownExportMenu'
import { ImportUrlRendererSelect, parseImportUrlRendererSelection, type ImportUrlRendererSelection } from './ImportUrlRendererSelect'
import { buildAutoWebsiteImportOptions, shouldAutoImportUrlAsWebsite } from './importUrlWebsiteMode'

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
  const [urlDraft, setUrlDraft] = React.useState('')
  const [urlInputOpen, setUrlInputOpen] = React.useState(false)
  const [importUrlRenderer, setImportUrlRenderer] = React.useState<ImportUrlRendererSelection>('default')
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false)
  const [pdfMenuOpen, setPdfMenuOpen] = React.useState(false)
  const importUrlControlsId = React.useId()

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
  }, [open])

  const openExportMenu = React.useCallback(() => {
    setUrlInputOpen(false)
    setExportMenuOpen(true)
  }, [])

  const closeExportMenu = React.useCallback(() => {
    setExportMenuOpen(false)
    setPdfMenuOpen(false)
  }, [])

  const openPdfMenu = React.useCallback(() => {
    setPdfMenuOpen(true)
  }, [])

  const closePdfMenu = React.useCallback(() => {
    setPdfMenuOpen(false)
  }, [])

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
    async (urlRaw: string, opts?: { canvas2dRenderer?: WorkspaceUrlImportCanvasRendererId | null; documentSemanticMode?: WorkspaceUrlImportDocumentModeId | null }) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importUrlFallback({ urlRaw, canvas2dRenderer: opts?.canvas2dRenderer, documentSemanticMode: opts?.documentSemanticMode, pushUiToast })
    },
    [pushUiToast],
  )

  const importUrlDeerFlowFallback = React.useCallback(
    async (urlRaw: string, opts?: { canvas2dRenderer?: WorkspaceUrlImportCanvasRendererId | null; documentSemanticMode?: WorkspaceUrlImportDocumentModeId | null }) => {
      const mod = await loadLaunchDropdownFallbackModule()
      await mod.importUrlDeerFlowFallback({ urlRaw, canvas2dRenderer: opts?.canvas2dRenderer, documentSemanticMode: opts?.documentSemanticMode, pushUiToast })
    },
    [pushUiToast],
  )

  const runImportUrl = React.useCallback(
    (nextUrlRaw: string) => {
      const nextUrl = String(nextUrlRaw || '').trim()
      if (!nextUrl) return
      onClose()
      const launchBridge = getMarkdownWorkspaceActionBridge()
      const opts = parseImportUrlRendererSelection(importUrlRenderer) || undefined
      if (!opts && typeof launchBridge.importWebsite === 'function' && shouldAutoImportUrlAsWebsite(nextUrl)) {
        launchBridge.importWebsite(nextUrl, buildAutoWebsiteImportOptions())
      } else if (typeof launchBridge.importUrl === 'function') launchBridge.importUrl(nextUrl, opts)
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
      const opts = parseImportUrlRendererSelection(importUrlRenderer) || undefined
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
    UI_RESPONSIVE_LAUNCH_MENU_ROW_CLASSNAME,
    'gap-2 rounded text-sm',
    UI_THEME_TOKENS.text.primary,
    UI_THEME_TOKENS.button.hoverBg,
  )
  const menuIconClass = 'w-4 h-4 shrink-0'
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

  const exportActions = React.useMemo<LaunchDropdownExportActions>(
    () => ({ ...fallbackExportActions, ...((bridge.export || {}) as LaunchDropdownExportActions) }),
    [bridge.export, fallbackExportActions],
  )
  const canExport = hasLaunchDropdownExportActions(exportActions)

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
                setExportMenuOpen(false)
                setPdfMenuOpen(false)
                setUrlInputOpen(true)
              }}
              aria-expanded={urlInputOpen}
              aria-controls={importUrlControlsId}
            >
              <Link className={menuIconClass} strokeWidth={1.6} />
              <span className="truncate">Import URL</span>
              <ChevronDown className={`ml-auto ${menuIconClass} transition-transform ${urlInputOpen ? 'rotate-180' : ''}`} strokeWidth={1.6} aria-hidden="true" />
            </button>
            {urlInputOpen ? (
              <section id={importUrlControlsId} className="kg-launch-menu-children kg-click-expand-menu-children mt-1">
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
                    <section className="flex min-w-0 flex-1 items-stretch gap-1">
                      <ImportUrlRendererSelect
                        value={importUrlRenderer}
                        onChange={setImportUrlRenderer}
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

          <LaunchDropdownExportMenu
            canExport={canExport}
            exportActions={exportActions}
            exportMenuOpen={exportMenuOpen}
            pdfMenuOpen={pdfMenuOpen}
            menuItemClass={menuItemClass}
            menuIconClass={menuIconClass}
            openExportMenu={openExportMenu}
            closeExportMenu={closeExportMenu}
            openPdfMenu={openPdfMenu}
            closePdfMenu={closePdfMenu}
            runExportAction={runExportAction}
          />

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
