import React from 'react'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { PanelCheckbox } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_RESPONSIVE_FLOW_MANAGER_ACTION_MENU_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_INLINE_CONTROL_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_PANEL_BODY_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_PANEL_HEADER_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_TOOLBAR_ROW_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import { cn } from '@/lib/utils'
import WidgetRegistryTable from '@/features/storyboard-widget-manager/WidgetRegistryTable'
import { StoryboardWidgetMappingSettingsPanel } from '@/features/storyboard-widget-manager/StoryboardWidgetMappingSettingsPanel'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import type { StoryboardWidgetMappingRow } from '@/features/storyboard-widget-manager/mappingRows'

export const STORYBOARD_WIDGET_MAPPING_LAYOUT_CLASS_NAME = 'kg-storyboard-widget-mapping-layout'

export function StoryboardWidgetMappingTabLayout(props: {
  panelTypographyMicroLabelClass: string
  enabledOnly: boolean
  setEnabledOnly: (v: boolean) => void
  importRegistryFromJson: () => void
  exportRegistryAsJson: () => void
  selectedExists: boolean
  openCreateFromWidget: () => void
  registerSelectedNodeTypeFromSelection: () => void
  registerGenerateVideoFromSelection: () => void
  applySelectedMappingToSelectedNode: () => void
  openCreate: () => void
  filtered: WidgetRegistryEntry[]
  selectedId: string | null
  handleSelect: (id: string | null) => void
  toggleWidgetRegistryEntryEnabled: (id: string) => void
  emptyLabel: string
  editorMode: 'none' | 'create' | 'edit'
  editorDraft: Omit<WidgetRegistryEntry, 'updatedAt'>
  editorRows: StoryboardWidgetMappingRow[]
  editorError: string | null
  uiIconScale: 'compact' | 'default' | undefined
  uiIconStrokeWidth: number
  closeEditor: () => void
  setEditorDraft: React.Dispatch<React.SetStateAction<Omit<WidgetRegistryEntry, 'updatedAt'>>>
  addEditorRow: () => void
  resetEditor: () => void
  saveEditor: () => void
  deleteEditor: () => void
  updateEditorRow: (id: string, patch: Partial<StoryboardWidgetMappingRow>) => void
  deleteEditorRow: (id: string) => void
  reorderEditorRow: (id: string, direction: 'up' | 'down') => void
}) {
  const selectionControlClassName = `rounded ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.selectionControl}`

  return (
    <section className="h-full min-h-0 flex flex-col" aria-label="Storyboard Widget Mapping">
      <header className={cn(UI_RESPONSIVE_FLOW_MANAGER_PANEL_HEADER_CLASSNAME, UI_THEME_TOKENS.panel.border)}>
        <nav className={cn(UI_RESPONSIVE_FLOW_MANAGER_TOOLBAR_ROW_CLASSNAME, 'flex-wrap')} aria-label="Mapping actions">
          <label className={`${UI_RESPONSIVE_FLOW_MANAGER_INLINE_CONTROL_CLASSNAME} ${props.panelTypographyMicroLabelClass} ${UI_THEME_TOKENS.text.secondary}`}>
            <PanelCheckbox
              className={selectionControlClassName}
              checked={props.enabledOnly}
              onChange={e => props.setEnabledOnly(e.target.checked)}
            />
            Enabled only
          </label>
          <menu className={cn(UI_RESPONSIVE_FLOW_MANAGER_ACTION_MENU_CLASSNAME, 'flex-wrap')} aria-label="Mapping toolbar">
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.importRegistryFromJson} title={UI_COPY.storyboardWidgetManagerImportRegistryTooltip}>
                {UI_LABELS.import}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.exportRegistryAsJson} title={props.selectedExists ? UI_COPY.storyboardWidgetManagerExportRegistryTooltip : UI_COPY.storyboardWidgetManagerExportRegistrySelectToExportTooltip}>
                {UI_LABELS.export}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.openCreateFromWidget} title={UI_COPY.storyboardWidgetManagerAddFromWidgetTooltip}>
                {UI_LABELS.addFromWidget}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={props.registerSelectedNodeTypeFromSelection}
                title={UI_COPY.storyboardWidgetManagerRegisterSelectedNodeTypeTooltip}
              >
                {UI_LABELS.registerNodeType}
              </button>
            </li>
            <li>
              <button type="button" className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`} onClick={props.registerGenerateVideoFromSelection} title={UI_COPY.storyboardWidgetManagerRegisterGenerateVideoTooltip}>
                {UI_LABELS.registerGenerateVideo}
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={props.applySelectedMappingToSelectedNode}
                title={UI_COPY.storyboardWidgetManagerApplySelectedMappingToNodeTooltip}
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
        <section className={STORYBOARD_WIDGET_MAPPING_LAYOUT_CLASS_NAME} aria-label="Mapping layout">
          <section className="min-h-0 overflow-hidden" aria-label="Mapping list">
            <WidgetRegistryTable
              entries={props.filtered}
              selectedId={props.selectedId}
              onSelect={props.handleSelect}
              onToggleEnabled={props.toggleWidgetRegistryEntryEnabled}
              emptyLabel={props.emptyLabel}
            />
          </section>
          <section
            className={cn(UI_RESPONSIVE_FLOW_MANAGER_PANEL_BODY_CLASSNAME, `min-h-0 border-l ${UI_THEME_TOKENS.panel.border} overflow-hidden`, 'hidden lg:block')}
            aria-label="Edit mapping panel"
          >
            <StoryboardWidgetMappingSettingsPanel
              mode={props.editorMode}
              draft={{
                id: props.editorDraft.id,
                isEnabled: props.editorDraft.isEnabled,
                nodeTypeId: props.editorDraft.nodeTypeId,
                widgetTypeId: props.editorDraft.widgetTypeId,
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
