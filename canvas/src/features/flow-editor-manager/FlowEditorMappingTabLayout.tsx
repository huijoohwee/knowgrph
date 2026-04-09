import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import NodeQuickEditorRegistryTable from '@/features/flow-editor-manager/NodeQuickEditorRegistryTable'
import { FlowEditorMappingSettingsPanel } from '@/features/flow-editor-manager/FlowEditorMappingSettingsPanel'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import type { FlowEditorMappingRow } from '@/features/flow-editor-manager/mappingRows'

export function FlowEditorMappingTabLayout(props: {
  panelTypographyMicroLabelClass: string
  enabledOnly: boolean
  setEnabledOnly: (v: boolean) => void
  importRegistryFromJson: () => void
  exportRegistryAsJson: () => void
  selectedExists: boolean
  openCreateFromNodeQuickEditor: () => void
  registerSelectedNodeTypeFromSelection: () => void
  registerGenerateVideoFromSelection: () => void
  applySelectedMappingToSelectedNode: () => void
  openCreate: () => void
  filtered: NodeQuickEditorRegistryEntry[]
  selectedId: string | null
  handleSelect: (id: string | null) => void
  toggleNodeQuickEditorRegistryEntryEnabled: (id: string) => void
  emptyLabel: string
  editorMode: 'none' | 'create' | 'edit'
  editorDraft: Omit<NodeQuickEditorRegistryEntry, 'updatedAt'>
  editorRows: FlowEditorMappingRow[]
  editorError: string | null
  uiIconScale: 'compact' | 'default' | undefined
  uiIconStrokeWidth: number
  closeEditor: () => void
  setEditorDraft: React.Dispatch<React.SetStateAction<Omit<NodeQuickEditorRegistryEntry, 'updatedAt'>>>
  addEditorRow: () => void
  resetEditor: () => void
  saveEditor: () => void
  deleteEditor: () => void
  updateEditorRow: (id: string, patch: Partial<FlowEditorMappingRow>) => void
  deleteEditorRow: (id: string) => void
  reorderEditorRow: (id: string, direction: 'up' | 'down') => void
}) {
  return (
    <section className="h-full min-h-0 flex flex-col" aria-label="Flow Editor Mapping">
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Mapping actions">
          <label className={`inline-flex items-center gap-2 ${props.panelTypographyMicroLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
            <input type="checkbox" checked={props.enabledOnly} onChange={e => props.setEnabledOnly(e.target.checked)} />
            Enabled only
          </label>
          <menu className="m-0 p-0 list-none flex flex-wrap items-center gap-1" aria-label="Mapping toolbar">
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.importRegistryFromJson} title={UI_COPY.flowEditorManagerImportRegistryTooltip}>
                {UI_LABELS.import}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.exportRegistryAsJson} title={props.selectedExists ? UI_COPY.flowEditorManagerExportRegistryTooltip : UI_COPY.flowEditorManagerExportRegistrySelectToExportTooltip}>
                {UI_LABELS.export}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.openCreateFromNodeQuickEditor} title={UI_COPY.flowEditorManagerAddFromQuickEditorTooltip}>
                {UI_LABELS.addFromQuickEditor}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={props.registerSelectedNodeTypeFromSelection}
                title={UI_COPY.flowEditorManagerRegisterSelectedNodeTypeTooltip}
              >
                {UI_LABELS.registerNodeType}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.registerGenerateVideoFromSelection} title={UI_COPY.flowEditorManagerRegisterGenerateVideoTooltip}>
                {UI_LABELS.registerGenerateVideo}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={props.applySelectedMappingToSelectedNode}
                title={UI_COPY.flowEditorManagerApplySelectedMappingToNodeTooltip}
              >
                {UI_LABELS.applyToNode}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.openCreate}>
                {UI_LABELS.add} mapping
              </button>
            </li>
          </menu>
        </nav>
      </header>

      <section className="flex-1 min-h-0 overflow-hidden" aria-label="Mapping content">
        <section className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_520px]" aria-label="Mapping layout">
          <section className="min-h-0 overflow-hidden" aria-label="Mapping list">
            <NodeQuickEditorRegistryTable
              entries={props.filtered}
              selectedId={props.selectedId}
              onSelect={props.handleSelect}
              onToggleEnabled={props.toggleNodeQuickEditorRegistryEntryEnabled}
              emptyLabel={props.emptyLabel}
            />
          </section>
          <section
            className={cn(`min-h-0 border-l ${UI_THEME_TOKENS.panel.border} overflow-hidden p-3`, 'hidden lg:block')}
            aria-label="Edit mapping panel"
          >
            <FlowEditorMappingSettingsPanel
              mode={props.editorMode}
              draft={{
                id: props.editorDraft.id,
                isEnabled: props.editorDraft.isEnabled,
                nodeTypeId: props.editorDraft.nodeTypeId,
                quickEditorTypeId: props.editorDraft.quickEditorTypeId,
                formId: props.editorDraft.formId,
              }}
              rows={props.editorRows}
              error={props.editorError}
              uiIconScale={props.uiIconScale}
              uiIconStrokeWidth={props.uiIconStrokeWidth}
              onClose={props.closeEditor}
              onChangeDraft={patch => props.setEditorDraft(prev => ({ ...prev, ...patch }))}
              onAddRow={props.addEditorRow}
              onReset={props.resetEditor}
              onSave={props.saveEditor}
              onDelete={props.deleteEditor}
              onChangeRow={props.updateEditorRow}
              onDeleteRow={props.deleteEditorRow}
              onReorderRow={props.reorderEditorRow}
            />
          </section>
        </section>
      </section>
    </section>
  )
}
