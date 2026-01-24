import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { OPENFREEMAP_STYLE_URL } from '@/lib/geospatial/styles'
import StatusBadge from '@/features/panels/ui/StatusBadge'

export default function GeospatialPanel() {
  const {
    geospatialOverlayEnabled,
    setGeospatialOverlayEnabled,
    geospatialStyleUrl,
    setGeospatialStyleUrl,
    geospatialOverlayOpacity,
    setGeospatialOverlayOpacity,
    geospatialInteractionMode,
    setGeospatialInteractionMode,
    geospatialProjectionMode,
    setGeospatialProjectionMode,
    geospatialAnimateCamera,
    setGeospatialAnimateCamera,
    geospatialAutoFitEnabled,
    setGeospatialAutoFitEnabled,
    geospatialDatasets,
    addGeospatialDatasetUrl,
    removeGeospatialDataset,
    toggleGeospatialDatasetEnabled,
    setGeospatialDatasetLabel,
    geospatialDatasetStatusById,
    requestGeospatialDatasetReload,
    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs,
    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes,
    geospatialGraphPoiColor,
    setGeospatialGraphPoiColor,
    geospatialGraphPoiSelectedColor,
    setGeospatialGraphPoiSelectedColor,
    requestGeospatialFitToData,
    canvasRenderMode,
    requestZoom,
    requestThreeCamera,
  } = useGraphStore(
    useShallow(s => ({
      geospatialOverlayEnabled: s.geospatialOverlayEnabled,
      setGeospatialOverlayEnabled: s.setGeospatialOverlayEnabled,
      geospatialStyleUrl: s.geospatialStyleUrl,
      setGeospatialStyleUrl: s.setGeospatialStyleUrl,
      geospatialOverlayOpacity: s.geospatialOverlayOpacity,
      setGeospatialOverlayOpacity: s.setGeospatialOverlayOpacity,
      geospatialInteractionMode: s.geospatialInteractionMode,
      setGeospatialInteractionMode: s.setGeospatialInteractionMode,
      geospatialProjectionMode: s.geospatialProjectionMode,
      setGeospatialProjectionMode: s.setGeospatialProjectionMode,
      geospatialAnimateCamera: s.geospatialAnimateCamera,
      setGeospatialAnimateCamera: s.setGeospatialAnimateCamera,
      geospatialAutoFitEnabled: s.geospatialAutoFitEnabled,
      setGeospatialAutoFitEnabled: s.setGeospatialAutoFitEnabled,
      geospatialDatasets: s.geospatialDatasets,
      addGeospatialDatasetUrl: s.addGeospatialDatasetUrl,
      removeGeospatialDataset: s.removeGeospatialDataset,
      toggleGeospatialDatasetEnabled: s.toggleGeospatialDatasetEnabled,
      setGeospatialDatasetLabel: s.setGeospatialDatasetLabel,
      geospatialDatasetStatusById: s.geospatialDatasetStatusById,
      requestGeospatialDatasetReload: s.requestGeospatialDatasetReload,
      geospatialDatasetTimeoutMs: s.geospatialDatasetTimeoutMs,
      setGeospatialDatasetTimeoutMs: s.setGeospatialDatasetTimeoutMs,
      geospatialDatasetMaxBytes: s.geospatialDatasetMaxBytes,
      setGeospatialDatasetMaxBytes: s.setGeospatialDatasetMaxBytes,
      geospatialGraphPoiColor: s.geospatialGraphPoiColor,
      setGeospatialGraphPoiColor: s.setGeospatialGraphPoiColor,
      geospatialGraphPoiSelectedColor: s.geospatialGraphPoiSelectedColor,
      setGeospatialGraphPoiSelectedColor: s.setGeospatialGraphPoiSelectedColor,
      requestGeospatialFitToData: s.requestGeospatialFitToData,
      canvasRenderMode: s.canvasRenderMode,
      requestZoom: s.requestZoom,
      requestThreeCamera: s.requestThreeCamera,
    })),
  )

  const [newLabel, setNewLabel] = React.useState('')
  const [newUrl, setNewUrl] = React.useState('')
  const normalizePickerColor = (value: string, fallback: string): string =>
    /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback
  const formatBytes = (n: number): string => {
    const v = Number(n)
    if (!Number.isFinite(v) || v <= 0) return '0 B'
    if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`
    if (v >= 1024) return `${Math.round(v / 1024)} KB`
    return `${Math.round(v)} B`
  }
  const handleFitToData = React.useCallback(() => {
    if (!geospatialOverlayEnabled) return
    if (canvasRenderMode === '3d') {
      requestGeospatialFitToData()
      requestThreeCamera('fit')
      return
    }
    requestZoom('fit')
  }, [canvasRenderMode, geospatialOverlayEnabled, requestGeospatialFitToData, requestThreeCamera, requestZoom])

  return (
    <div className={`h-full flex flex-col ${UI_THEME_TOKENS.panel.bg}`}>
      <div className={`p-2 border-b ${UI_THEME_TOKENS.panel.border}`}>
        <div className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_LABELS.geospatialMode}</div>
        <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialPanelSubtitle}</div>
        <div className="mt-2 flex items-center gap-2">
          <label className={`flex items-center gap-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
            <input
              type="checkbox"
              checked={geospatialOverlayEnabled}
              onChange={e => setGeospatialOverlayEnabled(e.target.checked)}
            />
            {UI_COPY.geospatialOverlayEnabledLabel}
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        <div className="space-y-1">
          <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialStyleUrlLabel}</div>
          <input
            className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
            value={geospatialStyleUrl}
            onChange={e => setGeospatialStyleUrl(e.target.value)}
            placeholder={UI_COPY.geospatialStyleUrlPlaceholder}
          />
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span>{UI_COPY.geospatialStyleHintPrefix}</span>
            <button
              className="underline hover:text-blue-600"
              onClick={() => setGeospatialStyleUrl(OPENFREEMAP_STYLE_URL)}
            >
              {UI_COPY.geospatialStyleHintOpenFreeMap}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialOverlayOpacityLabel}</div>
          <div className="flex items-center gap-2">
            <input
              className="w-full"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={geospatialOverlayOpacity}
              onChange={e => setGeospatialOverlayOpacity(Number(e.target.value))}
            />
            <div className={`text-xs tabular-nums ${UI_THEME_TOKENS.text.tertiary}`}>
              {Math.round(geospatialOverlayOpacity * 100)}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialInteractionTitle}</div>
          <div className="space-y-1">
            <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialInteractionModeLabel}</div>
            <select
              className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={geospatialInteractionMode}
              onChange={e =>
                setGeospatialInteractionMode(
                  e.target.value === 'always' ? 'always' : e.target.value === 'off' ? 'off' : 'hold-space',
                )
              }
            >
              <option value="off">{UI_COPY.geospatialInteractionModeOff}</option>
              <option value="hold-space">{UI_COPY.geospatialInteractionModeHoldSpace}</option>
              <option value="always">{UI_COPY.geospatialInteractionModeAlways}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialProjectionTitle}</div>
          <div className="space-y-1">
            <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialProjectionModeLabel}</div>
            <select
              className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={geospatialProjectionMode}
              onChange={e =>
                setGeospatialProjectionMode(
                  e.target.value === 'globe' ? 'globe' : e.target.value === 'mercator' ? 'mercator' : 'auto',
                )
              }
            >
              <option value="auto">{UI_COPY.geospatialProjectionModeAuto}</option>
              <option value="mercator">{UI_COPY.geospatialProjectionModeMercator}</option>
              <option value="globe">{UI_COPY.geospatialProjectionModeGlobe}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialAnimationsTitle}</div>
          <label className={`flex items-center gap-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
            <input
              type="checkbox"
              checked={geospatialAnimateCamera}
              onChange={e => setGeospatialAnimateCamera(e.target.checked)}
            />
            {UI_COPY.geospatialAnimateCameraLabel}
          </label>
          <label className={`flex items-center gap-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
            <input
              type="checkbox"
              checked={geospatialAutoFitEnabled}
              onChange={e => setGeospatialAutoFitEnabled(e.target.checked)}
            />
            {UI_COPY.geospatialAutoFitEnabledLabel}
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialDatasetsTitle}</div>
            <button
              type="button"
              className="App-toolbar__btn bg-gray-100 text-gray-700 text-xs"
              onClick={handleFitToData}
              disabled={!geospatialOverlayEnabled}
            >
              {UI_COPY.geospatialFitToDataLabel}
            </button>
          </div>

          <div className="space-y-2">
            <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialGraphPoiColorsTitle}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialGraphPoiColorLabel}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className={`w-10 h-7 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent`}
                    value={normalizePickerColor(geospatialGraphPoiColor, '#2563EB')}
                    onChange={e => setGeospatialGraphPoiColor(e.target.value)}
                  />
                  <input
                    className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                    value={geospatialGraphPoiColor}
                    onChange={e => setGeospatialGraphPoiColor(e.target.value)}
                    placeholder="#2563EB"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialGraphPoiSelectedColorLabel}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className={`w-10 h-7 p-0 border ${UI_THEME_TOKENS.input.border} rounded cursor-pointer bg-transparent`}
                    value={normalizePickerColor(geospatialGraphPoiSelectedColor, '#2563EB')}
                    onChange={e => setGeospatialGraphPoiSelectedColor(e.target.value)}
                  />
                  <input
                    className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                    value={geospatialGraphPoiSelectedColor}
                    onChange={e => setGeospatialGraphPoiSelectedColor(e.target.value)}
                    placeholder="#2563EB"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>{UI_COPY.geospatialDatasetFetchLimitsTitle}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialDatasetFetchTimeoutLabel}</div>
                <input
                  className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={geospatialDatasetTimeoutMs}
                  onChange={e => setGeospatialDatasetTimeoutMs(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <div className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>{UI_COPY.geospatialDatasetFetchMaxBytesLabel}</div>
                <input
                  className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                  type="number"
                  min={64 * 1024}
                  max={50 * 1024 * 1024}
                  step={256 * 1024}
                  value={geospatialDatasetMaxBytes}
                  onChange={e => setGeospatialDatasetMaxBytes(Number(e.target.value))}
                />
                <div className={`text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>
                  {UI_COPY.geospatialDatasetFetchMaxBytesHint(geospatialDatasetMaxBytes / (1024 * 1024))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder={UI_COPY.geospatialDatasetLabelPlaceholder}
            />
            <input
              className={`w-full text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder={UI_COPY.geospatialDatasetUrlPlaceholder}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="App-toolbar__btn bg-blue-50 text-blue-700 text-xs"
                onClick={() => {
                  addGeospatialDatasetUrl({ url: newUrl, label: newLabel })
                  setNewLabel('')
                  setNewUrl('')
                }}
              >
                {UI_LABELS.add}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {geospatialDatasets.length === 0 && (
              <div className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{UI_COPY.geospatialDatasetsEmpty}</div>
            )}
            {geospatialDatasets.map(d => {
              const status = geospatialDatasetStatusById?.[d.id] || { state: 'idle' as const }
              const statusBadge = (() => {
                if (status.state === 'ready') {
                  return <StatusBadge label="geospatial-dataset" ok={true} msg="ready" details={`${status.featureCount} features`} />
                }
                if (status.state === 'error') {
                  return <StatusBadge label="geospatial-dataset" ok={false} msg="error" details={status.message} below />
                }
                if (status.state === 'loading') {
                  const loaded = typeof status.loadedBytes === 'number' ? status.loadedBytes : 0
                  const total = typeof status.totalBytes === 'number' ? status.totalBytes : null
                  const pct = total && total > 0 ? Math.min(100, Math.max(0, Math.floor((loaded / total) * 100))) : null
                  const msg = pct != null ? `loading ${pct}%` : UI_COPY.geospatialDatasetStatusLoading
                  const details = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : `${formatBytes(loaded)}`
                  return <StatusBadge label="geospatial-dataset" ok={null} msg={msg} details={details} />
                }
                return <StatusBadge label="geospatial-dataset" ok={null} msg={UI_COPY.geospatialDatasetStatusIdle} />
              })()
              return (
                <div key={d.id} className={`rounded border p-2 ${UI_THEME_TOKENS.panel.border}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label className={`flex items-center gap-2 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={() => toggleGeospatialDatasetEnabled(d.id)}
                      />
                      <input
                        className={`text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                        value={d.label}
                        onChange={e => setGeospatialDatasetLabel(d.id, e.target.value)}
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="group relative select-none rounded inline-flex items-center justify-center p-2 hover:bg-gray-100 App-toolbar__btn text-gray-700"
                        onClick={() => requestGeospatialDatasetReload(d.id)}
                        aria-label="Reload dataset"
                        title="Reload dataset"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="group relative select-none rounded inline-flex items-center justify-center p-2 hover:bg-gray-100 App-toolbar__btn text-gray-700"
                        onClick={() => removeGeospatialDataset(d.id)}
                        aria-label="Remove dataset"
                        title="Remove dataset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`mt-1 text-[11px] break-all ${UI_THEME_TOKENS.text.tertiary}`}>{d.source.url}</div>
                  <div className="mt-2">{statusBadge}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
