import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { OPENFREEMAP_STYLE_URL } from '@/lib/geospatial/styles'

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
    geospatialDatasetTimeoutMs,
    setGeospatialDatasetTimeoutMs,
    geospatialDatasetMaxBytes,
    setGeospatialDatasetMaxBytes,
    geospatialGraphPoiColor,
    setGeospatialGraphPoiColor,
    geospatialGraphPoiSelectedColor,
    setGeospatialGraphPoiSelectedColor,
    requestGeospatialFitToData,
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
      geospatialDatasetTimeoutMs: s.geospatialDatasetTimeoutMs,
      setGeospatialDatasetTimeoutMs: s.setGeospatialDatasetTimeoutMs,
      geospatialDatasetMaxBytes: s.geospatialDatasetMaxBytes,
      setGeospatialDatasetMaxBytes: s.setGeospatialDatasetMaxBytes,
      geospatialGraphPoiColor: s.geospatialGraphPoiColor,
      setGeospatialGraphPoiColor: s.setGeospatialGraphPoiColor,
      geospatialGraphPoiSelectedColor: s.geospatialGraphPoiSelectedColor,
      setGeospatialGraphPoiSelectedColor: s.setGeospatialGraphPoiSelectedColor,
      requestGeospatialFitToData: s.requestGeospatialFitToData,
    })),
  )

  const [newLabel, setNewLabel] = React.useState('')
  const [newUrl, setNewUrl] = React.useState('')
  const [newFormat, setNewFormat] = React.useState<'auto' | 'geojson' | 'records'>('auto')
  const normalizePickerColor = (value: string, fallback: string): string =>
    /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback

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
              onClick={requestGeospatialFitToData}
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
              <select
                className={`text-xs rounded border px-2 py-1 ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text}`}
                value={newFormat}
                onChange={e => setNewFormat(e.target.value === 'geojson' ? 'geojson' : e.target.value === 'records' ? 'records' : 'auto')}
              >
                <option value="auto">{UI_COPY.geospatialDatasetFormatAuto}</option>
                <option value="geojson">{UI_COPY.geospatialDatasetFormatGeoJson}</option>
                <option value="records">{UI_COPY.geospatialDatasetFormatRecords}</option>
              </select>
              <button
                type="button"
                className="App-toolbar__btn bg-blue-50 text-blue-700 text-xs"
                onClick={() => {
                  addGeospatialDatasetUrl({ url: newUrl, label: newLabel, format: newFormat })
                  setNewLabel('')
                  setNewUrl('')
                  setNewFormat('auto')
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
              const statusText = (() => {
                if (status.state === 'loading') return UI_COPY.geospatialDatasetStatusLoading
                if (status.state === 'ready') return UI_COPY.geospatialDatasetStatusReady(status.featureCount)
                if (status.state === 'error') return UI_COPY.geospatialDatasetStatusError(status.message)
                return UI_COPY.geospatialDatasetStatusIdle
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
                    <button
                      type="button"
                      className="App-toolbar__btn bg-gray-100 text-gray-700 text-xs"
                      onClick={() => removeGeospatialDataset(d.id)}
                    >
                      {UI_COPY.geospatialDatasetRemoveLabel}
                    </button>
                  </div>
                  <div className={`mt-1 text-[11px] break-all ${UI_THEME_TOKENS.text.tertiary}`}>{d.source.url}</div>
                  <div className={`mt-1 text-[11px] ${UI_THEME_TOKENS.text.tertiary}`}>{statusText}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
