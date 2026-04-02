import React from 'react'
import { GEOSPATIAL_STYLE_URL_CHANGED_EVENT } from 'grph-shared/geospatial/constants'
import { requestGeospatialFitToData, requestGeospatialFitToSelection } from './geospatialFit'
import { LS_KEYS } from './lib/config'
import { useGympgrphStore } from './store'

type GeospatialPanelHostProps = {
  active?: boolean
  showDatasetsManager?: boolean
  panelTypography?: unknown
  snapshot?: unknown
  handlers?: unknown
}

const readLsString = (key: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    return v == null ? fallback : String(v)
  } catch {
    return fallback
  }
}

const writeLsString = (key: string, value: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    void 0
  }
}

export function GeospatialPanelHost(props: GeospatialPanelHostProps): React.ReactElement {
  const active = props.active !== false
  const geospatialViewMode = useGympgrphStore(s => s.geospatialViewMode)
  const geospatialAutoFitEnabled = useGympgrphStore(s => s.geospatialAutoFitEnabled)
  const geospatialDatasetTimeoutMs = useGympgrphStore(s => s.geospatialDatasetTimeoutMs)
  const geospatialDatasetMaxBytes = useGympgrphStore(s => s.geospatialDatasetMaxBytes)
  const setGeospatialViewMode = useGympgrphStore(s => s.setGeospatialViewMode)
  const setGeospatialAutoFitEnabled = useGympgrphStore(s => s.setGeospatialAutoFitEnabled)
  const setGeospatialDatasetTimeoutMs = useGympgrphStore(s => s.setGeospatialDatasetTimeoutMs)
  const setGeospatialDatasetMaxBytes = useGympgrphStore(s => s.setGeospatialDatasetMaxBytes)

  const [styleUrlDraft, setStyleUrlDraft] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, ''))
  const [committedStyleUrl, setCommittedStyleUrl] = React.useState<string>(() => readLsString(LS_KEYS.geospatialStyleUrl, ''))

  const committedStyleUrlRef = React.useRef(committedStyleUrl)
  React.useEffect(() => {
    committedStyleUrlRef.current = committedStyleUrl
  }, [committedStyleUrl])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onChanged = () => {
      const next = readLsString(LS_KEYS.geospatialStyleUrl, '')
      setCommittedStyleUrl(next)
      setStyleUrlDraft(prev => (prev === '' || prev === committedStyleUrlRef.current ? next : prev))
    }
    window.addEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(GEOSPATIAL_STYLE_URL_CHANGED_EVENT, onChanged)
    }
  }, [])

  const applyStyleUrl = React.useCallback(() => {
    const next = String(styleUrlDraft || '').trim()
    writeLsString(LS_KEYS.geospatialStyleUrl, next)
    setCommittedStyleUrl(next)
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
      } catch {
        void 0
      }
    }
  }, [styleUrlDraft])

  const resetStyleUrl = React.useCallback(() => {
    setStyleUrlDraft('')
    writeLsString(LS_KEYS.geospatialStyleUrl, '')
    setCommittedStyleUrl('')
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event(GEOSPATIAL_STYLE_URL_CHANGED_EVENT))
      } catch {
        void 0
      }
    }
  }, [])

  const timeoutDraft = React.useMemo(() => String(Math.floor(geospatialDatasetTimeoutMs)), [geospatialDatasetTimeoutMs])
  const maxBytesMbDraft = React.useMemo(() => String(Math.round(geospatialDatasetMaxBytes / (1024 * 1024))), [geospatialDatasetMaxBytes])

  const [timeoutMsInput, setTimeoutMsInput] = React.useState(timeoutDraft)
  const [maxBytesMbInput, setMaxBytesMbInput] = React.useState(maxBytesMbDraft)

  React.useEffect(() => {
    setTimeoutMsInput(timeoutDraft)
  }, [timeoutDraft])

  React.useEffect(() => {
    setMaxBytesMbInput(maxBytesMbDraft)
  }, [maxBytesMbDraft])

  const commitTimeoutMs = React.useCallback(() => {
    const n = Number(String(timeoutMsInput).trim())
    if (!Number.isFinite(n)) return
    setGeospatialDatasetTimeoutMs(n)
  }, [setGeospatialDatasetTimeoutMs, timeoutMsInput])

  const commitMaxBytes = React.useCallback(() => {
    const mb = Number(String(maxBytesMbInput).trim())
    if (!Number.isFinite(mb)) return
    setGeospatialDatasetMaxBytes(mb * 1024 * 1024)
  }, [maxBytesMbInput, setGeospatialDatasetMaxBytes])

  const disabled = !active

  return (
    <div className="h-full w-full p-3 text-sm text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Geospatial</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">style: {committedStyleUrl ? 'custom' : 'default'}</div>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[12px] text-gray-600 dark:text-gray-300">View</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={() => setGeospatialViewMode('2d')}
            >
              2D (MapLibre){geospatialViewMode === '2d' ? ' (active)' : ''}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={() => setGeospatialViewMode('3d')}
            >
              3D (MapLibre Globe){geospatialViewMode === '3d' ? ' (active)' : ''}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-[12px] text-gray-600 dark:text-gray-300">Auto-fit</label>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => setGeospatialAutoFitEnabled(!geospatialAutoFitEnabled)}
          >
            {geospatialAutoFitEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => requestGeospatialFitToData()}
          >
            Fit to data
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
            disabled={disabled}
            onClick={() => requestGeospatialFitToSelection()}
          >
            Fit to selection
          </button>
        </div>

        <div className="mt-2">
          <div className="text-[12px] text-gray-600 dark:text-gray-300">Basemap style URL</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              value={styleUrlDraft}
              onChange={e => setStyleUrlDraft(e.target.value)}
              placeholder="https://tiles.openfreemap.org/styles/liberty"
              spellCheck={false}
              disabled={disabled}
            />
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={applyStyleUrl}
            >
              Apply
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
              disabled={disabled}
              onClick={resetStyleUrl}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-2">
          <div className="text-[12px] text-gray-600 dark:text-gray-300">Dataset loading</div>
          <div className="mt-1 grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[12px] text-gray-600 dark:text-gray-300">Timeout (ms)</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-28 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                  value={timeoutMsInput}
                  onChange={e => setTimeoutMsInput(e.target.value)}
                  onBlur={commitTimeoutMs}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[12px] text-gray-600 dark:text-gray-300">Max bytes (MB)</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-28 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-black/40"
                  value={maxBytesMbInput}
                  onChange={e => setMaxBytesMbInput(e.target.value)}
                  onBlur={commitMaxBytes}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
