import { useGraphStore } from '@/hooks/useGraphStore'
import type { SettingMeta } from './types'

const s = () => useGraphStore.getState()

export const uiImportYoutubeSettingsRegistry: SettingMeta[] = [
  {
    key: 'youtubeTranscriptOutputDir',
    type: 'string',
    source: 'store',
    read: () => s().youtubeTranscriptOutputDir,
    write: v => s().setYoutubeTranscriptOutputDir(String(v || '')),
    docKey: 'youtubeTranscriptOutputDir',
    default: () => '',
  },
  {
    key: 'youtubeTranscriptOutputFormat',
    type: 'string',
    source: 'store',
    read: () => s().youtubeTranscriptOutputFormat,
    write: v => s().setYoutubeTranscriptOutputFormat(String(v) === 'json' ? 'json' : 'markdown'),
    docKey: 'youtubeTranscriptOutputFormat',
    default: () => 'markdown',
    options: ['markdown', 'json'],
  },
]

