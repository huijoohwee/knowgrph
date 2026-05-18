import React from 'react'
import { Download } from 'lucide-react'
import { WORKSPACE_EXPORT_MENU_ITEMS, type ExportMenuActionKey } from '@/lib/toolbar/exportMenuSsot'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type LaunchDropdownExportActions = Partial<Record<ExportMenuActionKey, () => void>>

type LaunchDropdownExportMenuProps = {
  canExport: boolean
  exportActions: LaunchDropdownExportActions
  exportMenuOpen: boolean
  pdfMenuOpen: boolean
  menuItemClass: string
  menuIconClass: string
  openExportMenu: () => void
  scheduleCloseExportMenu: () => void
  openPdfMenu: () => void
  scheduleClosePdfMenu: () => void
  runExportAction: (label: string, action: (() => void) | undefined) => void
}

const NON_PDF_EXPORT_ITEMS = WORKSPACE_EXPORT_MENU_ITEMS.filter(
  item => item.id !== 'pdfPortrait' && item.id !== 'pdfLandscape',
)

const EXPORT_ACTION_KEYS: readonly ExportMenuActionKey[] = [
  'duplicateInWorkspace',
  'workspaceFileJsonLd',
  'markdown',
  'png',
  'gltf',
  'glb',
  'htmlViewer',
  'htmlCanvas',
  'json',
  'svg',
  'pdfPortrait',
  'pdfLandscape',
]

export const hasLaunchDropdownExportActions = (actions: LaunchDropdownExportActions): boolean =>
  EXPORT_ACTION_KEYS.some(key => typeof actions[key] === 'function')

export function LaunchDropdownExportMenu({
  canExport,
  exportActions,
  exportMenuOpen,
  pdfMenuOpen,
  menuItemClass,
  menuIconClass,
  openExportMenu,
  scheduleCloseExportMenu,
  openPdfMenu,
  scheduleClosePdfMenu,
  runExportAction,
}: LaunchDropdownExportMenuProps) {
  const canExportPdf = Boolean(exportActions.pdfPortrait || exportActions.pdfLandscape)
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

  return (
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
            {NON_PDF_EXPORT_ITEMS.map(item => (
              <li key={item.id} className="list-none">
                <button
                  type="button"
                  className={menuItemClass}
                  onPointerDown={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    runExportAction(item.toastLabel, exportActions[item.id])
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
                      runExportAction('PDF Landscape', exportActions.pdfLandscape || exportActions.pdfPortrait)
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
                            runExportAction('PDF Portrait', exportActions.pdfPortrait)
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
                            runExportAction('PDF Landscape', exportActions.pdfLandscape)
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
  )
}
