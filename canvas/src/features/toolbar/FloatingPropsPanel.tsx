import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useFloatingPropsPanelModel } from '@/features/toolbar/useFloatingPropsPanelModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import NodeQuickEditorPalette from '@/features/toolbar/NodeQuickEditorPalette'
import FloatingPropsPanelMenuButton from '@/features/toolbar/FloatingPropsPanelMenuButton'

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

  const nodeQuickEditorRegistry = useGraphStore(s => s.nodeQuickEditorRegistry || [])
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const quickEditorPaletteEntries = React.useMemo(
    () => (Array.isArray(nodeQuickEditorRegistry) ? nodeQuickEditorRegistry : []).filter(e => e && e.isEnabled),
    [nodeQuickEditorRegistry],
  )
  const quickEditorDragEnabled = canvasRenderMode === '2d' && canvas2dRenderer === 'flowEditor'

  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const setMediaNodeOpacity = useGraphStore(s => s.setMediaNodeOpacity)
  const mediaPanelDensity = useGraphStore(s => s.mediaPanelDensity)
  const setMediaPanelDensity = useGraphStore(s => s.setMediaPanelDensity)

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

  return (
    <div className={`min-w-56 ${UI_THEME_TOKENS.panel.bg}`}>
      <section className="border-b border-[color:var(--kg-border)]" aria-label="Node Quick Editors">
        <NodeQuickEditorPalette entries={quickEditorPaletteEntries} dragEnabled={quickEditorDragEnabled} />
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
                Media view
              </span>
              <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(false)}
                  className={`px-2 py-1 text-[11px] ${uiPanelTextFontClass} ${renderMediaAsNodes ? `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}` : `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`}`}
                >
                  Circle-only
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(true)}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} border-l ${UI_THEME_TOKENS.panel.border} ${uiPanelTextFontClass} ${renderMediaAsNodes ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  Panel-only
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>
                Panel layout
              </span>
              <div className={`inline-flex rounded border ${UI_THEME_TOKENS.panel.border} overflow-hidden ${UI_THEME_TOKENS.panel.headerBg}`}>
                <button
                  type="button"
                  onClick={() => setMediaPanelDensity('default')}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} ${uiPanelTextFontClass} ${mediaPanelDensity === 'default' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setMediaPanelDensity('compact')}
                  className={`px-2 py-1 ${uiPanelMicroLabelTextSizeClass} border-l ${UI_THEME_TOKENS.panel.border} ${uiPanelTextFontClass} ${mediaPanelDensity === 'compact' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}`}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.secondary}`}
            >
              Opacity
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
