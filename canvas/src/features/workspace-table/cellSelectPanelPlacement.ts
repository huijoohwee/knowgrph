import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'

export type WorkspaceCellSelectPanelPlacement = 'top' | 'bottom'

export const WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_OPTIONS: WorkspaceCellSelectPanelPlacement[] = ['top', 'bottom']

export const WORKSPACE_CELL_SELECT_PANEL_PLACEMENT_LABELS: Record<WorkspaceCellSelectPanelPlacement, string> = {
  top: 'Above cell',
  bottom: 'Below cell',
}

export function parseWorkspaceCellSelectPanelPlacement(raw: unknown): WorkspaceCellSelectPanelPlacement | null {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'top') return 'top'
  if (v === 'bottom') return 'bottom'
  return null
}

export function readWorkspaceCellSelectPanelPlacement(): WorkspaceCellSelectPanelPlacement {
  return (
    lsJson(
      LS_KEYS.workspaceCellSelectPanelPlacement,
      'top' as WorkspaceCellSelectPanelPlacement,
      parseWorkspaceCellSelectPanelPlacement,
    ) || 'top'
  )
}

export function writeWorkspaceCellSelectPanelPlacement(next: WorkspaceCellSelectPanelPlacement): WorkspaceCellSelectPanelPlacement {
  const v = parseWorkspaceCellSelectPanelPlacement(next) || 'top'
  lsSetJson(LS_KEYS.workspaceCellSelectPanelPlacement, v)
  return v
}

