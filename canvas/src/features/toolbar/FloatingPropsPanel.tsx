import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import {
  KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  KTV_STATUS_TEXT_SIZE_CLASS_NAME,
} from 'grph-shared/ui/keyTypeValueRows'
import { useFloatingPropsPanelModel } from '@/features/toolbar/useFloatingPropsPanelModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import WidgetPalette from '@/features/toolbar/WidgetPalette'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'
import FloatingPropsPanelProbeTreeButton from '@/features/toolbar/FloatingPropsPanelProbeTreeButton'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'
import { isPropsPanelWidgetPaletteEntry } from '@/features/storyboard-widget-manager/registryTemplates'
import { NODE_MEDIA_KINDS, type NodeMediaKind } from '@/components/GraphCanvas/helpers'
import { RICH_MEDIA_DISPLAY_COPY, readRichMediaDisplayMode } from '@/lib/render/richMediaSsot'
import {
  UI_RESPONSIVE_FLOATING_PANEL_SUBPANEL_CLASSNAME,
  UI_RESPONSIVE_CONTROL_COMPACT_VALUE_ROW_CLASSNAME,
  UI_RESPONSIVE_CONTROL_VALUE_ROW_CLASSNAME,
  UI_RESPONSIVE_PANEL_FIELD_LABEL_CLASSNAME,
  UI_RESPONSIVE_PANEL_FIELD_LABEL_WIDE_CLASSNAME,
  UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME,
  UI_RESPONSIVE_PANEL_FIELD_VALUE_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'
import {
  uiToolbarSettingsPanelActionGroupClassName,
  uiToolbarSettingsPanelBodyClassName,
  uiToolbarSettingsPanelFooterClassName,
  uiToolbarSettingsPanelTextActionClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { PanelRangeInput, PanelSelect, PanelTextInput, readPanelBooleanChoiceButtonClassName } from '@/lib/ui/panelFormControls'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []
const FLOATING_MEDIA_VIEW_OPTIONS = [
  { value: false, label: RICH_MEDIA_DISPLAY_COPY.circleOnly },
  { value: true, label: RICH_MEDIA_DISPLAY_COPY.panelOnly },
] as const
const FLOATING_MEDIA_DENSITY_OPTIONS = [
  { value: 'default', label: RICH_MEDIA_DISPLAY_COPY.densityDefault },
  { value: 'compact', label: RICH_MEDIA_DISPLAY_COPY.densityCompact },
] as const
function isFloatingMediaKind(value: string): value is NodeMediaKind {
  return NODE_MEDIA_KINDS.includes(value as NodeMediaKind)
}

export function FloatingPropsPanel() {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || KTV_ROW_TEXT_SIZE_FALLBACK_CLASS_NAME,
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || KTV_STATUS_TEXT_SIZE_CLASS_NAME,
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
  )
  const effectiveWidgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const widgetPaletteEntries = React.useMemo(
    () => (Array.isArray(effectiveWidgetRegistry) ? effectiveWidgetRegistry : []).filter(isPropsPanelWidgetPaletteEntry),
    [effectiveWidgetRegistry],
  )
  const widgetDragEnabled = widgetPaletteEntries.length > 0
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const setMediaNodeOpacity = useGraphStore(s => s.setMediaNodeOpacity)
  const mediaPanelDensity = useGraphStore(s => s.mediaPanelDensity)
  const setMediaPanelDensity = useGraphStore(s => s.setMediaPanelDensity)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled === true)
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode)
  const richMediaDisplayMode = readRichMediaDisplayMode({
    renderMediaAsNodes,
    canvasRenderMode,
    canvas3dMode,
    canvas2dRenderer,
    frontmatterModeEnabled,
    documentSemanticMode,
  })
  const schema = useGraphStore(s => s.schema) as GraphSchema
  const setSchema = useGraphStore(s => s.setSchema)

  const {
    nodeTypes,
    catalogTypes,
    edgeLabels,
    newType,
    setNewType,
    newLabel,
    setNewLabel,
    newEdgeLabel,
    setNewEdgeLabel,
    mediaKind,
    setMediaKind,
    mediaUrl,
    setMediaUrl,
    mediaInteractive,
    setMediaInteractive,
    canUseNodeContext,
    canUseEdgeContext,
    doUpdateMedia,
    doOpenNodeSide,
    doOpenNodeNodesTab,
    doOpenNodeCodeTab,
    doShowNodeInMarkdown,
    doAddToChat,
    doStartEdgeFromNode,
    doCreateNodeAndEdge,
    doDeleteNode,
    doOpenSourceSide,
    doOpenTargetSide,
    doUpdateSource,
    doUpdateTarget,
    doOpenEdgeEdgesTab,
    doOpenEdgeCodeTab,
    doShowEdgeInMarkdown,
    doAddNode,
    doAddNodePlusEdgeFromSelected,
    doStartEdgeFromSelected,
    doAddMediaNode,
  } = useFloatingPropsPanelModel()

  const forces = schema.layout?.forces || {}
  const antiLineStrength = typeof forces.antiLineStrength === 'number' && Number.isFinite(forces.antiLineStrength)
    ? forces.antiLineStrength
    : 0.06
  const postFitStrength = typeof forces.postFitStrength === 'number' && Number.isFinite(forces.postFitStrength)
    ? forces.postFitStrength
    : 0.34
  const postFitAlphaMax = typeof forces.postFitAlphaMax === 'number' && Number.isFinite(forces.postFitAlphaMax)
    ? forces.postFitAlphaMax
    : 0.12
  const panelFieldLabelClassName = cn(
    UI_RESPONSIVE_PANEL_FIELD_LABEL_CLASSNAME,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    'font-normal',
    UI_THEME_TOKENS.text.secondary,
  )
  const panelFieldWideLabelClassName = cn(
    UI_RESPONSIVE_PANEL_FIELD_LABEL_WIDE_CLASSNAME,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    'font-normal',
    UI_THEME_TOKENS.text.secondary,
  )
  const panelFieldTextInputClassName = cn(
    uiPanelKeyValueInputClass,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    UI_RESPONSIVE_PANEL_FIELD_VALUE_CLASSNAME,
    'text-left',
  )
  const panelFieldPrimarySelectClassName = cn(
    panelFieldTextInputClassName,
    UI_THEME_TOKENS.text.primary,
    UI_THEME_TOKENS.input.bg,
  )
  const panelFieldNumericInputClassName = cn(
    uiPanelKeyValueInputClass,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    UI_RESPONSIVE_PANEL_FIELD_VALUE_CLASSNAME,
    'text-right',
  )
  const panelFieldRangeValueClassName = cn(
    UI_RESPONSIVE_PANEL_FIELD_VALUE_CLASSNAME,
    UI_RESPONSIVE_CONTROL_VALUE_ROW_CLASSNAME,
  )
  const panelFieldToggleValueClassName = cn(
    UI_RESPONSIVE_PANEL_FIELD_VALUE_CLASSNAME,
    UI_RESPONSIVE_CONTROL_COMPACT_VALUE_ROW_CLASSNAME,
  )

  return (
    <section
      className={`${UI_RESPONSIVE_FLOATING_PANEL_SUBPANEL_CLASSNAME} ${UI_THEME_TOKENS.panel.bg}`}
      aria-label="Props Panel"
    >
      <section className="border-b border-[color:var(--kg-border)]" aria-label="Widgets">
        <section className={cn('px-2 py-1 flex items-center justify-between', UI_THEME_TOKENS.panel.bg)}>
          <span className={cn(uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.tertiary)}>Widgets</span>
        </section>
        <WidgetPalette entries={widgetPaletteEntries} dragEnabled={widgetDragEnabled} />
      </section>

      <CollapsibleSection
        title="Add"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <section className="px-3 py-2">
          <section className={`mb-2 ${UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}`}>
            <label className={panelFieldLabelClassName}>
              Type
            </label>
            <PanelSelect
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className={panelFieldPrimarySelectClassName}
            >
              {catalogTypes.map(t => (
                <option key={t} value={t} className={UI_THEME_TOKENS.panel.bg}>
                  {t}
                </option>
              ))}
              {nodeTypes
                .filter(t => !catalogTypes.includes(t))
                .map(t => (
                  <option key={t} value={t} className={UI_THEME_TOKENS.panel.bg}>
                    {t}
                  </option>
                ))}
              {!catalogTypes.length && !nodeTypes.length && (
                <option value="entity" className={UI_THEME_TOKENS.panel.bg}>
                  entity
                </option>
              )}
            </PanelSelect>
          </section>
          <section className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>
            <label className={panelFieldLabelClassName}>
              Label
            </label>
            <PanelTextInput
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className={panelFieldTextInputClassName}
            />
          </section>
          <section className={`mt-2 ${UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}`}>
            <label className={panelFieldLabelClassName}>
              Edge Label
            </label>
            <PanelSelect
              value={newEdgeLabel}
              onChange={e => setNewEdgeLabel(e.target.value)}
              className={panelFieldTextInputClassName}
            >
              {edgeLabels.map(l => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              {!edgeLabels.length && (
                <option value="link">
                  link
                </option>
              )}
            </PanelSelect>
          </section>
        </section>
        <FloatingPropsPanelMenuButton onClick={doAddNode} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelAddNode}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton
          onClick={doAddNodePlusEdgeFromSelected}
          disabled={!canUseNodeContext}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelTextFontClass={uiPanelTextFontClass}
        >
          {UI_COPY.propsPanelAddNodeAndEdgeFromSelected}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton
          onClick={doStartEdgeFromSelected}
          disabled={!canUseNodeContext}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelTextFontClass={uiPanelTextFontClass}
        >
          {UI_COPY.propsPanelStartEdgeFromSelected}
        </FloatingPropsPanelMenuButton>
      </CollapsibleSection>

      <CollapsibleSection
        title="Node"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <FloatingPropsPanelMenuButton onClick={doOpenNodeSide} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenInFloatingPanel}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenNodeNodesTab} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenInNodesTab}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenNodeCodeTab} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenInEditor}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doShowNodeInMarkdown} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelShowInMarkdown}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doAddToChat} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelAddToChat}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelProbeTreeButton disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass} />
        <FloatingPropsPanelMenuButton onClick={doStartEdgeFromNode} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelStartEdgeFromNode}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doCreateNodeAndEdge} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelCreateNodeAndEdgeSelectToEdit}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doDeleteNode} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelDeleteNode}
        </FloatingPropsPanelMenuButton>
      </CollapsibleSection>

      <CollapsibleSection
        title="Media"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <section className="px-3 py-2">
          <section className="mb-2 flex items-center justify-between gap-2">
            <section className="flex flex-col gap-1">
              <span className={`${uiPanelMicroLabelTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                {RICH_MEDIA_DISPLAY_COPY.viewLabel}
              </span>
              <section className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                {FLOATING_MEDIA_VIEW_OPTIONS.map((option, index) => {
                  const selected = richMediaDisplayMode === 'panel-only' ? option.value === true : option.value === false
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setRenderMediaAsNodes(option.value)}
                      className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} ${index > 0 ? `border-l ${UI_THEME_TOKENS.panel.border}` : ''} ${uiPanelTextFontClass} ${selected ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </section>
            </section>
            <section className="flex flex-col gap-1">
              <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                {RICH_MEDIA_DISPLAY_COPY.densityLabel}
              </span>
              <section className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                {FLOATING_MEDIA_DENSITY_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMediaPanelDensity(option.value)}
                    className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} ${index > 0 ? `border-l ${UI_THEME_TOKENS.panel.border}` : ''} ${uiPanelTextFontClass} ${mediaPanelDensity === option.value ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                  >
                    {option.label}
                  </button>
                ))}
              </section>
            </section>
          </section>
          <section className={`mb-2 ${UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}`}>
            <label className={panelFieldLabelClassName}>
              {RICH_MEDIA_DISPLAY_COPY.opacityLabel}
            </label>
            <section className={panelFieldRangeValueClassName}>
              <PanelRangeInput
                min={0}
                max={1}
                step={0.05}
                value={mediaNodeOpacity}
                onChange={e => setMediaNodeOpacity(Number(e.target.value))}
              />
              <span
                className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} shrink-0 text-right`}
              >
                {Math.round(mediaNodeOpacity * 100)}%
              </span>
            </section>
          </section>
          <section className={`mb-2 ${UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}`}>
            <label className={panelFieldLabelClassName}>
              Kind
            </label>
            <PanelSelect
              value={mediaKind}
              onChange={e => {
                const v = e.target.value
                if (isFloatingMediaKind(v)) setMediaKind(v)
              }}
              className={panelFieldTextInputClassName}
            >
              {NODE_MEDIA_KINDS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </PanelSelect>
          </section>
          <section className={`mb-2 ${UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}`}>
            <label className={panelFieldLabelClassName}>
              URL
            </label>
            <PanelTextInput
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              className={panelFieldTextInputClassName}
            />
          </section>
          <section className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>
            <label className={panelFieldLabelClassName}>
              Interactive
            </label>
            <section className={panelFieldToggleValueClassName}>
              <button
                type="button"
                className={readPanelBooleanChoiceButtonClassName({
                  active: !mediaInteractive,
                  className: uiPanelKeyValueTextSizeClass,
                })}
                onClick={() => setMediaInteractive(false)}
              >
                Off
              </button>
              <button
                type="button"
                className={readPanelBooleanChoiceButtonClassName({
                  active: mediaInteractive,
                  className: uiPanelKeyValueTextSizeClass,
                })}
                onClick={() => setMediaInteractive(true)}
              >
                On
              </button>
            </section>
          </section>
        </section>
        <FloatingPropsPanelMenuButton onClick={doUpdateMedia} disabled={!canUseNodeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          Update Media
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton
          onClick={doAddMediaNode}
          disabled={!mediaUrl.trim()}
          uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          uiPanelTextFontClass={uiPanelTextFontClass}
        >
          Add Media Node
        </FloatingPropsPanelMenuButton>
      </CollapsibleSection>

      <CollapsibleSection
        title="Layout"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <section className={uiToolbarSettingsPanelBodyClassName}>
          <section className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>
            <label className={panelFieldWideLabelClassName}>
              Anti-line strength
            </label>
            <PanelTextInput
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={antiLineStrength}
              onChange={e => {
                const current = schema
                const curLayout = current.layout || {}
                const curForces = curLayout.forces || {}
                const raw = Number.parseFloat(e.target.value)
                const next = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : antiLineStrength
                setSchema({
                  ...current,
                  layout: { ...curLayout, forces: { ...curForces, antiLineStrength: next } },
                })
              }}
              className={panelFieldNumericInputClassName}
            />
          </section>
          <section className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>
            <label className={panelFieldWideLabelClassName}>
              Post-fit strength
            </label>
            <PanelTextInput
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={postFitStrength}
              onChange={e => {
                const current = schema
                const curLayout = current.layout || {}
                const curForces = curLayout.forces || {}
                const raw = Number.parseFloat(e.target.value)
                const next = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : postFitStrength
                setSchema({
                  ...current,
                  layout: { ...curLayout, forces: { ...curForces, postFitStrength: next } },
                })
              }}
              className={panelFieldNumericInputClassName}
            />
          </section>
          <section className={UI_RESPONSIVE_PANEL_FIELD_ROW_CLASSNAME}>
            <label className={panelFieldWideLabelClassName}>
              Post-fit alpha max
            </label>
            <PanelTextInput
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={postFitAlphaMax}
              onChange={e => {
                const current = schema
                const curLayout = current.layout || {}
                const curForces = curLayout.forces || {}
                const raw = Number.parseFloat(e.target.value)
                const next = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : postFitAlphaMax
                setSchema({
                  ...current,
                  layout: { ...curLayout, forces: { ...curForces, postFitAlphaMax: next } },
                })
              }}
              className={panelFieldNumericInputClassName}
            />
          </section>
          <section className={uiToolbarSettingsPanelFooterClassName}>
            <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
              Strong spread preset
            </span>
            <section className={uiToolbarSettingsPanelActionGroupClassName}>
              <button
                type="button"
                className={`${uiToolbarSettingsPanelTextActionClassName} ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}
                onClick={() => {
                  const current = schema
                  const curLayout = current.layout || {}
                  const curForces = curLayout.forces || {}
                  const nextAnti = 0.1
                  const nextPostFit = 0.45
                  const nextAlphaMax = 0.16
                  setSchema({
                    ...current,
                    layout: {
                      ...curLayout,
                      forces: {
                        ...curForces,
                        antiLineStrength: nextAnti,
                        postFitStrength: nextPostFit,
                        postFitAlphaMax: nextAlphaMax,
                      },
                    },
                  })
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className={`${uiToolbarSettingsPanelTextActionClassName} ${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
                onClick={() => {
                  const current = schema
                  const curLayout = current.layout || {}
                  const curForces = curLayout.forces || {}
                  const baseForces = defaultSchema.layout?.forces || {}
                  const baseAnti = typeof baseForces.antiLineStrength === 'number' && Number.isFinite(baseForces.antiLineStrength)
                    ? baseForces.antiLineStrength
                    : 0.06
                  const basePost = typeof baseForces.postFitStrength === 'number' && Number.isFinite(baseForces.postFitStrength)
                    ? baseForces.postFitStrength
                    : 0.34
                  const baseAlpha = typeof baseForces.postFitAlphaMax === 'number' && Number.isFinite(baseForces.postFitAlphaMax)
                    ? baseForces.postFitAlphaMax
                    : 0.12

                  const isKeyword = documentSemanticMode === 'keyword'
                  const nextAnti = isKeyword
                    ? Math.max(0.02, Math.min(0.12, baseAnti * 1.5))
                    : baseAnti
                  const nextPostFit = isKeyword
                    ? Math.max(0.1, Math.min(0.6, basePost * 1.3))
                    : basePost
                  const nextAlphaMax = isKeyword
                    ? Math.max(0.05, Math.min(0.25, baseAlpha * 1.25))
                    : baseAlpha

                  setSchema({
                    ...current,
                    layout: {
                      ...curLayout,
                      forces: {
                        ...curForces,
                        antiLineStrength: nextAnti,
                        postFitStrength: nextPostFit,
                        postFitAlphaMax: nextAlphaMax,
                      },
                    },
                  })
                }}
              >
                Reset
              </button>
            </section>
          </section>
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        title="Edge"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <FloatingPropsPanelMenuButton onClick={doAddToChat} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelAddToChat}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenSourceSide} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenSourceInFloatingPanel}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenTargetSide} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenTargetInFloatingPanel}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doUpdateSource} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelUpdateSource}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doUpdateTarget} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelUpdateTarget}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenEdgeEdgesTab} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenInEdgesTab}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenEdgeCodeTab} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenInEditor}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doShowEdgeInMarkdown} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelShowInMarkdown}
        </FloatingPropsPanelMenuButton>
      </CollapsibleSection>
    </section>
  )

}
