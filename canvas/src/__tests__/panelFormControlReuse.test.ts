import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testPanelFormControlsAreSharedAcrossStrybldrAndDataViewDensity() {
  const sharedControlsText = readUtf8('src/lib/ui/panelFormControls.tsx')
  const strybldrPanelText = readUtf8('src/features/strybldr/StrybldrFloatingPanelView.tsx')
  const strybldrCameraPanelText = readUtf8('src/features/strybldr/StrybldrCameraPanel.tsx')
  const strybldrCameraFloatingText = readUtf8('src/features/strybldr/StrybldrCameraFloatingPanelView.tsx')
  const dataViewSettingsText = readUtf8('src/features/markdown-workspace/main/viewer/WorkspaceDataViewSettingsPanel.tsx')
  const dataViewFilterMenuText = readUtf8('src/features/markdown-workspace/main/viewer/WorkspaceDataViewFilterMenu.tsx')
  const dataViewSortSectionText = readUtf8('src/features/markdown-workspace/main/viewer/WorkspaceDataViewSettingsSortSection.tsx')
  const graphTableToolbarText = readUtf8('src/features/graph-table/ui/GraphTableToolbar.tsx')
  const graphEditorInspectorText = readUtf8('src/features/graph-editor/panels/GraphEditorInspectorTab.tsx')
  const researchCompilerText = readUtf8('src/features/panels/views/ResearchCompilerView.tsx')
  const siteSelectionWidgetText = readUtf8('src/features/maps/SiteSelectionWidget.tsx')
  const workspaceTableModeControlText = readUtf8('src/features/workspace-table/ui/WorkspaceTableModeControl.tsx')
  const designDomInspectPanelText = readUtf8('src/features/design/DesignDomInspectPanel.tsx')

  if (
    !sharedControlsText.includes('export function PanelField') ||
    !sharedControlsText.includes('export function PanelReadOnlyField') ||
    !sharedControlsText.includes('export const PanelTextInput') ||
    !sharedControlsText.includes('export const PanelTextarea') ||
    !sharedControlsText.includes('export const PanelSelect') ||
    !sharedControlsText.includes("type PanelFieldVariant = 'micro' | 'section'") ||
    !sharedControlsText.includes("type PanelFieldLayout = 'block' | 'compact'") ||
    !sharedControlsText.includes("type PanelFormControlVariant = 'filled' | 'transparent'") ||
    !sharedControlsText.includes('readPanelChoiceSurfaceClassName')
  ) {
    throw new Error('expected panel form controls to expose shared semantic field, read-only field, single-line, multi-line, select, transparent-variant, and choice-surface utilities')
  }

  if (
    !strybldrPanelText.includes("from '@/lib/ui/panelFormControls'") ||
    !strybldrPanelText.includes('PanelField') ||
    !strybldrPanelText.includes('PanelTextInput') ||
    !strybldrPanelText.includes('PanelTextarea') ||
    !strybldrPanelText.includes('PanelSelect') ||
    strybldrPanelText.includes("mt-1 min-h-14 w-full resize-y rounded-md border px-2 py-1 text-xs")
  ) {
    throw new Error('expected Strybldr floating panel card fields to consume the shared panel form controls')
  }

  if (
    !strybldrCameraPanelText.includes("from '@/lib/ui/panelFormControls'") ||
    !strybldrCameraPanelText.includes('PanelField') ||
    !strybldrCameraPanelText.includes('<PanelTextarea') ||
    !strybldrCameraPanelText.includes('<PanelField label="Note">')
  ) {
    throw new Error('expected Strybldr camera note field to use the shared semantic field and textarea controls')
  }

  if (!strybldrCameraFloatingText.includes("from '@/lib/ui/panelFormControls'") || !strybldrCameraFloatingText.includes('<PanelSelect')) {
    throw new Error('expected Strybldr camera floating panel to reuse the shared select control')
  }

  if (
    !dataViewSettingsText.includes("from '@/lib/ui/panelFormControls'") ||
    !dataViewSettingsText.includes('PanelField') ||
    !dataViewSettingsText.includes('PanelSelect') ||
    !dataViewSettingsText.includes('readPanelChoiceSurfaceClassName') ||
    !dataViewSettingsText.includes('<PanelTextInput') ||
    !dataViewSettingsText.includes('<PanelField\n                label="Projection"') ||
    !dataViewSettingsText.includes('<PanelField label="Group by" variant="section">') ||
    !dataViewSettingsText.includes('type="radio"') ||
    !dataViewSettingsText.includes('name="workspace-data-view-row-height"') ||
    !dataViewSettingsText.includes('name="workspace-data-view-field-line"') ||
    dataViewSettingsText.includes('<label className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>')
  ) {
    throw new Error('expected data-view settings controls to reuse semantic panel fields, shared selects, and the shared panel choice surface')
  }

  if (
    !dataViewFilterMenuText.includes("from '@/lib/ui/panelFormControls'") ||
    !dataViewFilterMenuText.includes('PanelField') ||
    !dataViewFilterMenuText.includes('<PanelTextInput')
  ) {
    throw new Error('expected data-view filter value input to reuse the shared semantic field and single-line panel input')
  }

  if (
    !dataViewSortSectionText.includes("from '@/lib/ui/panelFormControls'") ||
    !dataViewSortSectionText.includes('PanelField') ||
    !dataViewSortSectionText.includes('<PanelSelect') ||
    dataViewSortSectionText.includes('<label className="min-w-0 flex-1">') ||
    dataViewSortSectionText.includes('<label className="min-w-0">')
  ) {
    throw new Error('expected data-view sort controls to reuse the shared semantic field and panel select primitives')
  }

  if (
    !graphTableToolbarText.includes("from '@/lib/ui/panelFormControls'") ||
    !graphTableToolbarText.includes('PanelField') ||
    !graphTableToolbarText.includes('PanelTextInput') ||
    !graphTableToolbarText.includes('<PanelSelect') ||
    !graphTableToolbarText.includes('variant="transparent"') ||
    graphTableToolbarText.includes('<label className={menuFieldClass}>') ||
    graphTableToolbarText.includes('ml-2 px-2 rounded border')
  ) {
    throw new Error('expected graph-table filter and sort menus to reuse shared semantic panel fields plus transparent panel-form controls')
  }

  if (
    !graphEditorInspectorText.includes("from '@/lib/ui/panelFormControls'") ||
    !graphEditorInspectorText.includes('PanelField') ||
    !graphEditorInspectorText.includes('PanelReadOnlyField') ||
    !graphEditorInspectorText.includes('<PanelTextInput') ||
    !graphEditorInspectorText.includes('<PanelSelect') ||
    !graphEditorInspectorText.includes('<PanelReadOnlyField label="Source"')
  ) {
    throw new Error('expected graph editor inspector fields to reuse the shared semantic field, read-only field, single-line panel input, and panel select')
  }

  if (
    !researchCompilerText.includes("from '@/lib/ui/panelFormControls'") ||
    !researchCompilerText.includes('PanelField') ||
    !researchCompilerText.includes('PanelReadOnlyField') ||
    !researchCompilerText.includes('<PanelTextarea') ||
    !researchCompilerText.includes('<PanelTextInput') ||
    !researchCompilerText.includes('<PanelReadOnlyField label="Run ID"') ||
    !researchCompilerText.includes('variant="transparent"') ||
    researchCompilerText.includes('min-h-24 resize-y rounded border') ||
    researchCompilerText.includes('w-28 rounded border') ||
    researchCompilerText.includes('<dl className="mt-2 grid grid-cols-2 gap-2 text-xs">')
  ) {
    throw new Error('expected research compiler prompt, token fields, and run status rows to reuse the shared panel-form primitives')
  }

  if (
    !siteSelectionWidgetText.includes("from '@/lib/ui/panelFormControls'") ||
    !siteSelectionWidgetText.includes('PanelField') ||
    !siteSelectionWidgetText.includes('PanelSelect') ||
    !siteSelectionWidgetText.includes('PanelTextInput') ||
    !siteSelectionWidgetText.includes('variant="transparent"') ||
    !siteSelectionWidgetText.includes('<fieldset') ||
    siteSelectionWidgetText.includes('bg-transparent border') ||
    siteSelectionWidgetText.includes('<div key={c.id}')
  ) {
    throw new Error('expected site selection widget candidate fields to reuse shared transparent panel-form primitives with semantic fieldsets')
  }

  if (
    !workspaceTableModeControlText.includes("from '@/lib/ui/panelFormControls'") ||
    !workspaceTableModeControlText.includes('PanelField') ||
    !workspaceTableModeControlText.includes('PanelSelect') ||
    !workspaceTableModeControlText.includes('PanelTextInput') ||
    workspaceTableModeControlText.includes(`<label className={\`${'${uiToolbarRowScrollJustifyBetweenClassName}'} gap-2 text-xs\`}>`)
  ) {
    throw new Error('expected workspace table mode control rows to reuse shared semantic field, select, and input primitives')
  }

  if (
    !designDomInspectPanelText.includes("from '@/lib/ui/panelFormControls'") ||
    !designDomInspectPanelText.includes('PanelReadOnlyField') ||
    !designDomInspectPanelText.includes('className={DESIGN_DOM_INSPECT_ROW_GRID_CLASS_NAME}') ||
    designDomInspectPanelText.includes("<section className={cn('text-[10px] font-mono', UI_THEME_TOKENS.text.tertiary)}>{props.k}</section>")
  ) {
    throw new Error('expected DesignDomInspectPanel rows to reuse the shared read-only field primitive while preserving the local row grid contract')
  }
}
