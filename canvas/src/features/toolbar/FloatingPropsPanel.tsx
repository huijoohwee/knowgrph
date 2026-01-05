import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY } from '@/lib/config'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { useFloatingPropsPanelModel } from '@/features/toolbar/useFloatingPropsPanelModel'

export function FloatingPropsPanel() {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass
      || 'w-full h-6 px-2 text-xs border border-gray-300 rounded text-right',
  )

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
    doAddNode,
    doAddNodePlusEdgeFromSelected,
    doStartEdgeFromSelected,
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
      className={`block w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-700`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )

  return (
    <div className="min-w-56 bg-white">
      <CollapsibleSection
        title="Add"
        stickyHeader={false}
        className="mt-0 border-t-0 pt-0"
        headerClassName={`px-2 ${uiPanelTextFontClass}`}
      >
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
            >
              Type
            </label>
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
            >
              {catalogTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {nodeTypes
                .filter(t => !catalogTypes.includes(t))
                .map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              {!catalogTypes.length && !nodeTypes.length && (
                <option value="entity">
                  entity
                </option>
              )}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
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
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
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
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
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
              disabled={!canUseNodeContext}
            >
              <option value="image">image</option>
              <option value="svg">svg</option>
              <option value="video">video</option>
              <option value="iframe">iframe</option>
            </select>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
            >
              URL
            </label>
            <input
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              className={`${uiPanelKeyValueInputClass} ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} w-[70%] text-left`}
              disabled={!canUseNodeContext}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`w-[30%] ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal text-gray-600`}
            >
              Interactive
            </label>
            <div className="w-[70%] flex items-center gap-1">
              <button
                type="button"
                className={`App-toolbar__btn text-xs border border-gray-300 ${!mediaInteractive ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
                onClick={() => setMediaInteractive(false)}
                disabled={!canUseNodeContext}
              >
                Off
              </button>
              <button
                type="button"
                className={`App-toolbar__btn text-xs border border-gray-300 ${mediaInteractive ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
                onClick={() => setMediaInteractive(true)}
                disabled={!canUseNodeContext}
              >
                On
              </button>
            </div>
          </div>
        </div>
        <MenuButton onClick={doUpdateMedia} disabled={!canUseNodeContext}>
          Update Media
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
      </CollapsibleSection>
    </div>
  )
}
