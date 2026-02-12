import flowDetailsStatic from './settings-flow.schema.json'
import type { FlowDetails, SettingMeta } from './types'
import { uiSettingsRegistry } from './registry-ui'
import { threeSettingsRegistry } from './registry-three'
import { presetAndEnvSettingsRegistry } from './registry-presets'

export const settingsRegistry: SettingMeta[] = [
  ...uiSettingsRegistry,
  ...threeSettingsRegistry,
  ...presetAndEnvSettingsRegistry,
  {
    key: 'app.youtube.transcriptOutputDir',
    type: 'string',
    source: 'store',
    read: (get) => get().youtubeTranscriptOutputDir || '/Users/huijoohwee/Documents/GitHub/sandbox/test-data/test-youtube-transcript',
    write: (set, value) => set({ youtubeTranscriptOutputDir: String(value) }),
    label: 'YouTube Transcript Output Directory',
    tooltip: {
      role: 'Configures where imported transcripts are saved.',
      actions: 'Enter an absolute path.',
      outcome: 'Transcripts will be saved to this directory.',
    },
  },
  {
    key: 'app.youtube.transcriptOutputFormat',
    type: 'string',
    source: 'store',
    read: (get) => get().youtubeTranscriptOutputFormat || 'markdown',
    write: (set, value) => set({ youtubeTranscriptOutputFormat: String(value) as 'markdown' | 'json' }),
    label: 'YouTube Transcript Output Format',
    tooltip: {
      role: 'Configures the file format for saved transcripts.',
      actions: 'Enter "markdown" or "json".',
      outcome: 'Transcripts will be saved in the specified format.',
    },
  },
]

const flowDetailsObject: Record<string, FlowDetails> =
  flowDetailsStatic && typeof flowDetailsStatic === 'object' && !Array.isArray(flowDetailsStatic)
    ? (flowDetailsStatic as Record<string, FlowDetails>)
    : {}

export async function loadFlowDetails(): Promise<Record<string, FlowDetails>> {
  return flowDetailsObject
}
