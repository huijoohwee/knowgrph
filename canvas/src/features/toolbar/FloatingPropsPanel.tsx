import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useFloatingPropsPanelModel } from '@/features/toolbar/useFloatingPropsPanelModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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

  const MenuButton = ({
    onClick,
    children,
    disabled,
  }: {
    onClick: () => void
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <button
      type="button"
      className={`block w-full text-left px-3 py-2 ${UI_THEME_TOKENS.table.rowHover} disabled:opacity-50 disabled:cursor-not-allowed ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.primary}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )

  return (
    <div className={`min-w-56 ${UI_THEME_TOKENS.panel.bg}`}>
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
        <MenuButton onClick={doAddNode}>
          {UI_COPY.propsPanelAddNode}
        </MenuButton>
        <MenuButton
          onClick={doAddNodePlusEdgeFromSelected}
          disabled={!canUseNodeContext}
        >
          {UI_COPY.propsPanelAddNodeAndEdgeFromSelected}
        </MenuButton>
        <MenuButton
          onClick={doStartEdgeFromSelected}
          disabled={!canUseNodeContext}
        >
          {UI_COPY.propsPanelStartEdgeFromSelected}
        </MenuButton>
      </CollapsibleSection>

      <CollapsibleSection
        title="Node"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <MenuButton onClick={doOpenNodeSide} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelOpenInSidePanel}
        </MenuButton>
        <MenuButton onClick={doOpenNodeNodesTab} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelOpenInNodesTab}
        </MenuButton>
        <MenuButton onClick={doOpenNodeCodeTab} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelOpenInEditor}
        </MenuButton>
        <MenuButton onClick={doShowNodeInMarkdown} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelShowInMarkdown}
        </MenuButton>
        <MenuButton onClick={doAddToChat} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelAddToChat}
        </MenuButton>
        <MenuButton onClick={doStartEdgeFromNode} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelStartEdgeFromNode}
        </MenuButton>
        <MenuButton onClick={doCreateNodeAndEdge} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelCreateNodeAndEdgeSelectToEdit}
        </MenuButton>
        <MenuButton onClick={doDeleteNode} disabled={!canUseNodeContext}>
          {UI_COPY.propsPanelDeleteNode}
        </MenuButton>
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
        <MenuButton onClick={doUpdateMedia} disabled={!canUseNodeContext}>
          Update Media
        </MenuButton>
        <MenuButton
          onClick={doAddMediaNode}
          disabled={!mediaUrl.trim()}
        >
          Add Media Node
        </MenuButton>
      </CollapsibleSection>

      <CollapsibleSection
        title="Edge"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <MenuButton onClick={doAddToChat} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelAddToChat}
        </MenuButton>
        <MenuButton onClick={doOpenSourceSide} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelOpenSourceInSidePanel}
        </MenuButton>
        <MenuButton onClick={doOpenTargetSide} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelOpenTargetInSidePanel}
        </MenuButton>
        <MenuButton onClick={doUpdateSource} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelUpdateSource}
        </MenuButton>
        <MenuButton onClick={doUpdateTarget} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelUpdateTarget}
        </MenuButton>
        <MenuButton onClick={doOpenEdgeEdgesTab} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelOpenInEdgesTab}
        </MenuButton>
        <MenuButton onClick={doOpenEdgeCodeTab} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelOpenInEditor}
        </MenuButton>
        <MenuButton onClick={doShowEdgeInMarkdown} disabled={!canUseEdgeContext}>
          {UI_COPY.propsPanelShowInMarkdown}
        </MenuButton>
      </CollapsibleSection>
    </div>
  )
}
