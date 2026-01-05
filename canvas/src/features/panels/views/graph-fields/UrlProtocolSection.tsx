import React from 'react'
import type { GraphFieldSettingsResolved, GraphFieldUrlProtocol } from '@/features/graph-fields/graphFields'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { UpdateSettings } from '@/features/panels/views/graph-fields/FieldSettingsSections.types'

export function UrlProtocolSection({
  selectedSettings,
  updateSettings,
}: {
  selectedSettings: GraphFieldSettingsResolved
  updateSettings: UpdateSettings
}) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  if (selectedSettings.fieldType !== 'URL') return null

  const setUrlProtocol = (urlProtocol: GraphFieldUrlProtocol) => updateSettings({ urlProtocol })

  return (
    <div className="rounded border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className={`${uiPanelKeyValueTextSizeClass} text-gray-700`}>Protocol</span>
        <span className={`${uiPanelKeyValueTextSizeClass} text-gray-500`}>{selectedSettings.urlProtocol}</span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          className={`App-toolbar__btn text-xs border border-gray-300 ${selectedSettings.urlProtocol === 'any' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
          onClick={() => setUrlProtocol('any')}
        >
          Any
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border border-gray-300 ${selectedSettings.urlProtocol === 'http' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
          onClick={() => setUrlProtocol('http')}
        >
          HTTP
        </button>
        <button
          type="button"
          className={`App-toolbar__btn text-xs border border-gray-300 ${selectedSettings.urlProtocol === 'https' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}
          onClick={() => setUrlProtocol('https')}
        >
          HTTPS
        </button>
      </div>
    </div>
  )
}

