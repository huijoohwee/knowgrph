import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import Tooltip from '@/features/panels/ui/Tooltip'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getNodeMediaSpec, hasNodeMedia, type NodeMediaSpec } from '@/components/GraphCanvas/helpers'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { RENDER_PANEL_SECTION_COPY } from '@/features/panels/config'
import { IFRAME_ALLOWED_HOSTS } from '@/lib/config'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'

type MediaNodeRow = {
  id: string
  label: string
  type: string
  media: NodeMediaSpec
}

export default function MediaNodesSection({
  toolbarAligned = false,
  collapsed,
  onToggle,
}: {
  toolbarAligned?: boolean
  collapsed?: boolean
  onToggle?: (next: boolean) => void
}) {
  const graph = useActiveGraphRenderData() as GraphData | null
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes)
  const mediaNodeOpacity = useGraphStore(s => s.mediaNodeOpacity)
  const setMediaNodeOpacity = useGraphStore(s => s.setMediaNodeOpacity)
  const copy = RENDER_PANEL_SECTION_COPY.mediaNodes

  const rows = React.useMemo<MediaNodeRow[]>(() => {
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return []
    const list: MediaNodeRow[] = []
    for (let i = 0; i < graph.nodes.length; i += 1) {
      const n = graph.nodes[i] as GraphNode
      if (!hasNodeMedia(n)) continue
      const spec = getNodeMediaSpec(n)
      if (!spec) continue
      list.push({
        id: String(n.id),
        label: String(n.label || n.id || ''),
        type: String(n.type || ''),
        media: spec,
      })
      if (list.length >= 200) break
    }
    return list
  }, [graph])

  const totalCount = rows.length
  const imageCount = rows.filter(r => r.media.kind === 'image' || r.media.kind === 'svg').length
  const videoCount = rows.filter(r => r.media.kind === 'video').length
  const iframeCount = rows.filter(r => r.media.kind === 'iframe').length

  const iframeHostsRaw = String(IFRAME_ALLOWED_HOSTS || '').trim()
  const iframeHostList = iframeHostsRaw
    ? iframeHostsRaw
        .split(/[,\s]+/)
        .map(h => h.trim())
        .filter(Boolean)
    : []
  const hasIframeHosts = iframeHostList.length > 0

  const titleContent = (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-2">
        {copy.badge && (
          <span
            className={[
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
              'font-semibold text-gray-500',
            ].join(' ')}
          >
            {copy.badge}
          </span>
        )}
        <span className="text-xs font-semibold text-gray-800">
          {copy.title}
        </span>
      </span>
      {copy.descriptionShort && (
        <span
          className={[
            uiPanelMicroLabelTextSizeClass,
            uiPanelTextFontClass,
            'text-gray-600',
          ].join(' ')}
        >
          {copy.descriptionShort}
        </span>
      )}
    </div>
  )

  return (
    <CollapsibleSection
      title={copy.tooltip ? (
        <Tooltip
          content={copy.tooltip}
          maxWidthPx={260}
          contentClassName="bg-gray-800/90"
        >
          {titleContent}
        </Tooltip>
      ) : (
        titleContent
      )}
      toolbarAligned={toolbarAligned}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {!graph || totalCount === 0 ? (
        <div
          className={[
            uiPanelMicroLabelTextSizeClass,
            uiPanelTextFontClass,
            'text-gray-600',
          ].join(' ')}
        >
          No media-capable nodes detected in the current GraphData.
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={[
              'grid grid-cols-4 gap-2 text-gray-700',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')}
          >
            <div className="flex flex-col">
              <span className="uppercase tracking-wide text-gray-500">Media nodes</span>
              <span className="font-semibold">{String(totalCount)}</span>
            </div>
            <div className="flex flex-col">
              <span className="uppercase tracking-wide text-gray-500">Images/SVG</span>
              <span className="font-semibold">{String(imageCount)}</span>
            </div>
            <div className="flex flex-col">
              <span className="uppercase tracking-wide text-gray-500">Video</span>
              <span className="font-semibold">{String(videoCount)}</span>
            </div>
            <div className="flex flex-col">
              <span className="uppercase tracking-wide text-gray-500">IFrame</span>
              <span className="font-semibold">{String(iframeCount)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tooltip
                content={copy.viewToggleHelper || ''}
                maxWidthPx={260}
                contentClassName="bg-gray-800/90"
              >
                <span
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-600 cursor-help',
                  ].join(' ')}
                >
                  View
                </span>
              </Tooltip>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden bg-gray-50">
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(false)}
                  className={[
                    'px-2 py-1 text-[11px]',
                    uiPanelTextFontClass,
                    renderMediaAsNodes
                      ? 'bg-gray-50 text-gray-600'
                      : 'bg-blue-600 text-white',
                  ].join(' ')}
                >
                  Circle-only
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMediaAsNodes(true)}
                  className={[
                    'px-2 py-1 text-[11px] border-l border-gray-300',
                    uiPanelTextFontClass,
                    renderMediaAsNodes
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-600',
                  ].join(' ')}
                >
                  Panel-only
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'text-gray-600',
                ].join(' ')}
              >
                Opacity
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mediaNodeOpacity}
                onChange={e => setMediaNodeOpacity(Number(e.target.value))}
                className="w-24"
              />
              <span
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'text-gray-700 w-10 text-right',
                ].join(' ')}
              >
                {Math.round(mediaNodeOpacity * 100)}%
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <span
              className={[
                uiPanelMicroLabelTextSizeClass,
                uiPanelTextFontClass,
                'text-gray-600',
              ].join(' ')}
            >
              Iframe allowlist (VITE_IFRAME_ALLOWED_HOSTS)
            </span>
            <span
              className={[
                uiPanelMicroLabelTextSizeClass,
                uiPanelTextFontClass,
                'text-gray-700',
              ].join(' ')}
            >
              {hasIframeHosts
                ? iframeHostList.join(', ')
                : 'Disabled — set VITE_IFRAME_ALLOWED_HOSTS for iframe media panels'}
            </span>
            {!hasIframeHosts && (
              <span
                className={[
                  uiPanelMicroLabelTextSizeClass,
                  uiPanelTextFontClass,
                  'text-gray-500',
                ].join(' ')}
              >
                Local dev/test example: VITE_IFRAME_ALLOWED_HOSTS=www.youtube.com,youtu.be,vimeo.com
              </span>
            )}
          </div>

          <div className="mt-2 border border-gray-200 rounded bg-white max-h-40 overflow-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr
                  className={[
                    uiPanelMicroLabelTextSizeClass,
                    uiPanelTextFontClass,
                    'text-gray-500 border-b border-gray-200',
                  ].join(' ')}
                >
                  <th className="px-2 py-1 w-20">Type</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1 w-20">Media</th>
                </tr>
              </thead>
              <tbody
                className={[
                  uiPanelKeyValueTextSizeClass,
                  uiPanelTextFontClass,
                  'text-gray-700',
                ].join(' ')}
              >
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-2 py-1 truncate">{row.type}</td>
                    <td className="px-2 py-1 truncate">{row.label}</td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1">
                        <span className="uppercase tracking-wide text-[10px] text-gray-500">
                          {row.media.kind}
                        </span>
                        <span className="inline-flex h-2 w-2 rounded-full bg-gray-400" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
