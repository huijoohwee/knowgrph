import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { SETTINGS_REGISTRY_BY_KEY } from './settingsView.constants'

type UseSettingsSyncArgs = {
  dirtyRef: React.MutableRefObject<Set<string>>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>
  values: Record<string, string | number | boolean>
}

function syncRegistryKeys({
  dirtyRef,
  keys,
  setValues,
  values,
}: {
  dirtyRef: React.MutableRefObject<Set<string>>
  keys: readonly string[]
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>
  values: Record<string, string | number | boolean>
}) {
  const dirtyKeys = keys.filter(key => dirtyRef.current.has(key))
  if (dirtyKeys.length === 0) return

  const patches: Record<string, string | number | boolean> = {}
  dirtyKeys.forEach(key => {
    const meta = SETTINGS_REGISTRY_BY_KEY.get(key)
    if (!meta?.write) return
    meta.write(values[key] as never)
    const next = meta.read()
    if (next !== null) {
      patches[key] = next as never
    }
    dirtyRef.current.delete(key)
  })

  if (Object.keys(patches).length > 0) {
    setValues(prev => ({ ...prev, ...patches }))
  }
}

export function useSettingsSync({ dirtyRef, setValues, values }: UseSettingsSyncArgs) {
  React.useEffect(() => {
    const shouldApplyProvider = dirtyRef.current.has('chatProvider')
    const shouldApplyAuthMode = dirtyRef.current.has('chatAuthMode')
    const shouldApplyApiKey = dirtyRef.current.has('chatApiKey')
    if (!shouldApplyProvider && !shouldApplyAuthMode && !shouldApplyApiKey) return

    const nextProvider = String(values.chatProvider || '').trim()
    const nextAuthMode = String(values.chatAuthMode || '').trim().toLowerCase() === 'byok' ? 'byok' : 'serverManaged'
    const nextApiKey = typeof values.chatApiKey === 'string' ? values.chatApiKey : ''

    const store = useGraphStore.getState()
    if (shouldApplyProvider) store.setChatProvider(nextProvider)
    if (shouldApplyAuthMode) store.setChatAuthMode(nextAuthMode)
    if (shouldApplyApiKey && nextAuthMode === 'byok') store.setChatApiKey(nextApiKey)

    const updated = useGraphStore.getState()
    const normalizedValues: Record<string, string> = {
      chatProvider: String(updated.chatProvider || '').trim(),
      chatAuthMode: updated.chatAuthMode === 'byok' ? 'byok' : 'serverManaged',
      chatEndpointUrl: String(updated.chatEndpointUrl || ''),
      chatModel: String(updated.chatModel || ''),
      chatApiKey: String(updated.chatApiKey || ''),
    }

    if (shouldApplyProvider) dirtyRef.current.delete('chatProvider')
    if (shouldApplyAuthMode) dirtyRef.current.delete('chatAuthMode')
    if (shouldApplyApiKey) dirtyRef.current.delete('chatApiKey')

    setValues(prev => ({ ...prev, ...normalizedValues }))
  }, [dirtyRef, setValues, values.chatApiKey, values.chatAuthMode, values.chatProvider])

  React.useEffect(() => {
    syncRegistryKeys({
      dirtyRef,
      keys: [
        'byteplusImageModel',
        'byteplusImageSize',
        'byteplusImageOutputFormat',
        'byteplusImageWatermark',
        'byteplusImageSeed',
        'byteplusImageGuidanceScale',
      ],
      setValues,
      values,
    })
  }, [
    dirtyRef,
    setValues,
    values,
    values.byteplusImageGuidanceScale,
    values.byteplusImageModel,
    values.byteplusImageOutputFormat,
    values.byteplusImageSeed,
    values.byteplusImageSize,
    values.byteplusImageWatermark,
  ])

  React.useEffect(() => {
    syncRegistryKeys({
      dirtyRef,
      keys: [
        'byteplusVideoModel',
        'byteplusVideoContentJson',
        'byteplusVideoResolution',
        'byteplusVideoRatio',
        'byteplusVideoDuration',
        'byteplusVideoGenerateAudio',
        'byteplusVideoDraft',
        'byteplusVideoCameraFixed',
        'byteplusVideoImageUrlUrl',
      ],
      setValues,
      values,
    })
  }, [
    dirtyRef,
    setValues,
    values,
    values.byteplusVideoCameraFixed,
    values.byteplusVideoContentJson,
    values.byteplusVideoDraft,
    values.byteplusVideoDuration,
    values.byteplusVideoGenerateAudio,
    values.byteplusVideoImageUrlUrl,
    values.byteplusVideoModel,
    values.byteplusVideoRatio,
    values.byteplusVideoResolution,
  ])
}
