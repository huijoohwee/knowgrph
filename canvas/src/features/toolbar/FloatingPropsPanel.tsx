import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useFloatingPropsPanelModel } from '@/features/toolbar/useFloatingPropsPanelModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import WidgetPalette from '@/features/toolbar/WidgetPalette'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { RICH_MEDIA_DISPLAY_COPY, readRichMediaDisplayMode } from '@/lib/render/richMediaSsot'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'

const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

export function FloatingPropsPanel() {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-[10px]',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || `w-full h-6 px-2 text-xs ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} rounded text-right`,
  )

  const documentWidgetRegistry = useGraphStore(s => s.documentWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const effectiveWidgetRegistry = useGraphStore(s => s.effectiveWidgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const baseWidgetRegistry = useGraphStore(s => s.widgetRegistry ?? EMPTY_WIDGET_REGISTRY)
  const widgetRegistry = React.useMemo(
    () =>
      buildDataflowWidgetRegistry({
        documentWidgetRegistry,
        effectiveWidgetRegistry,
        widgetRegistry: baseWidgetRegistry,
      }),
    [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry],
  )
  const widgetPaletteEntries = React.useMemo(
    () => (Array.isArray(widgetRegistry) ? widgetRegistry : []).filter(e => e && e.isEnabled),
    [widgetRegistry],
  )
  const widgetDragEnabled = widgetPaletteEntries.length > 0

  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const setMediaNodeOpacity = useGraphStore(s => s.setMediaNodeOpacity)
  const mediaPanelDensity = useGraphStore(s => s.mediaPanelDensity)
  const setMediaPanelDensity = useGraphStore(s => s.setMediaPanelDensity)
  const richMediaDisplayMode = readRichMediaDisplayMode(renderMediaAsNodes)
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode)
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

  return (
    <div className={`min-w-56 ${UI_THEME_TOKENS.panel.bg}`}>
      <section className="border-b border-[color:var(--kg-border)]" aria-label="Widgets">
        <div className={cn('px-2 py-1 flex items-center justify-between', UI_THEME_TOKENS.panel.bg)}>
          <span className={cn(uiPanelMicroLabelTextSizeClass, uiPanelTextFontClass, UI_THEME_TOKENS.text.tertiary)}>Widgets</span>
        </div>
        <WidgetPalette entries={widgetPaletteEntries} dragEnabled={widgetDragEnabled} />
      </section>

      <CollapsibleSection
        title="Add"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Type
            </label>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left ${UI_THEME_TOKENS.text.primary} ${UI_THEME_TOKENS.input.bg}`}
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
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Label
            </label>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Edge Label
            </label>
            <select
              value={newEdgeLabel}
              onChange={e => setNewEdgeLabel(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
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
            </select>
          </div>
        </div>
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
          {UI_COPY.propsPanelOpenInSidePanel}
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
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>
                {RICH_MEDIA_DISPLAY_COPY.viewLabel}
              </span>
              <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(false)}
                  className={`px-2 py-1 text-[11px] ${uiPanelTextFontClass} ${richMediaDisplayMode === 'panel-only' ? `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}` : `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}`}
                >
                  {RICH_MEDIA_DISPLAY_COPY.circleOnly}
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(true)}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} border-l ${UI_THEME_TOKENS.panel.border} ${uiPanelTextFontClass} ${richMediaDisplayMode === 'panel-only' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  {RICH_MEDIA_DISPLAY_COPY.panelOnly}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                {RICH_MEDIA_DISPLAY_COPY.densityLabel}
              </span>
              <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                <button
                  type="button"
                  onClick={() => setMediaPanelDensity('default')}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} ${uiPanelTextFontClass} ${mediaPanelDensity === 'default' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  {RICH_MEDIA_DISPLAY_COPY.densityDefault}
                </button>
                <button
                  type="button"
                  onClick={() => setMediaPanelDensity('compact')}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} border-l ${UI_THEME_TOKENS.panel.border} ${uiPanelTextFontClass} ${mediaPanelDensity === 'compact' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  {RICH_MEDIA_DISPLAY_COPY.densityCompact}
                </button>
              </div>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              {RICH_MEDIA_DISPLAY_COPY.opacityLabel}
            </label>
            <div className="w-[70%] flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mediaNodeOpacity}
                onChange={e => setMediaNodeOpacity(Number(e.target.value))}
                className="flex-1"
              />
              <span
                className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} w-10 text-right`}
              >
                {Math.round(mediaNodeOpacity * 100)}%
              </span>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Kind
            </label>
            <select
              value={mediaKind}
              onChange={e => {
                const v = e.target.value
                if (v === 'image' || v === 'svg' || v === 'video' || v === 'iframe') setMediaKind(v)
              }}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
            >
              <option value="image">image</option>
              <option value="svg">svg</option>
              <option value="video">video</option>
              <option value="iframe">iframe</option>
            </select>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              URL
            </label>
            <input
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Interactive
            </label>
            <div className="w-[70%] flex items-center gap-1">
              <button
                type="button"
                className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${!mediaInteractive ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
                onClick={() => setMediaInteractive(false)}
              >
                Off
              </button>
              <button
                type="button"
                className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.input.border} ${mediaInteractive ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.primary}`}`}
                onClick={() => setMediaInteractive(true)}
              >
                On
              </button>
            </div>
          </div>
        </div>
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
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <label
              className={`w-[40%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Anti-line strength
            </label>
            <input
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
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[60%] text-right`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[40%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Post-fit strength
            </label>
            <input
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
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[60%] text-right`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[40%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Post-fit alpha max
            </label>
            <input
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
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[60%] text-right`}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
              Strong spread preset
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`App-toolbar__btn text-[11px] px-2 py-1 rounded ${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}
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
                className={`App-toolbar__btn text-[11px] px-2 py-1 rounded ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
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
            </div>
          </div>
        </div>
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
          {UI_COPY.propsPanelOpenSourceInSidePanel}
        </FloatingPropsPanelMenuButton>
        <FloatingPropsPanelMenuButton onClick={doOpenTargetSide} disabled={!canUseEdgeContext} uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass} uiPanelTextFontClass={uiPanelTextFontClass}>
          {UI_COPY.propsPanelOpenTargetInSidePanel}
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
    </div>
  )
}
