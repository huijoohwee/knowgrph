import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from '@/features/panels/views/byteplusSharedTextApiDocs'

export const PIXVERSE_VIDEO_GENERATION_API_DOC_AREA = 'PixVerse Video Generation'
export const PIXVERSE_VIDEO_GENERATION_API_DOCS_URL = 'https://github.com/PixVerseAI/PixVerse-MCP'

type PixVerseVideoDocRow = {
  key: string
  typeLabel: string
  value: string
  responsibility: string
  notes?: string
  searchHints?: string[]
}

const toBaseType = (typeLabel: string): SettingMeta['type'] => {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (normalized.includes('boolean')) return 'boolean'
  if (normalized.includes('integer') || normalized.includes('number')) return 'number'
  if (normalized.includes('object') || normalized.includes('[]')) return 'json'
  return 'string'
}

export function getPixVerseVideoGenerationApiRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `pixverse-video-generation-row-${normalized || 'entry'}`
}

export const PIXVERSE_VIDEO_GENERATION_DOC_ROWS: ReadonlyArray<PixVerseVideoDocRow> = [
  {
    key: 'provider_mode',
    typeLabel: 'string',
    value: 'mainpanel-readiness',
    responsibility: 'Readiness marker for PixVerse video-generation setup outside the SuperAgent harness.',
    notes: 'The local SuperAgent harness defaults to BytePlus ModelArk placeholder mode; this row does not activate a PixVerse harness adapter.',
    searchHints: ['pixverse video generation readiness'],
  },
  {
    key: 'strategy',
    typeLabel: 'enum',
    value: 'auto | text-to-video | image-to-video | transition-video | fusion-video',
    responsibility: 'Generation strategy reference for PixVerse readiness documentation.',
    notes: 'Auto prefers transition-video for multi-scene plans with a reference frame, image-to-video for single-scene reference-frame runs, and text-to-video otherwise. Fusion-video is an explicit opt-in path.',
    searchHints: ['strategy auto image-to-video transition-video text-to-video fusion-video'],
  },
  {
    key: 'tool_chain',
    typeLabel: 'string[]',
    value: 'upload_image | upload_video | upload_audio -> fusion_video | image_to_video | transition_video | text_to_video -> get_video_status -> extend_video -> lip_sync_video | sound_effect_video',
    responsibility: 'Canonical PixVerse MCP tool chain used by Knowgrph.',
    notes: 'The adapter keeps this upstream of renderer projection, automates local uploaded-video and custom-audio resource handoff when the PixVerse MCP surface exposes those upload tools, and preserves mock fallback when live execution is unavailable.',
    searchHints: ['upload_image upload_video upload_audio fusion_video image_to_video transition_video text_to_video get_video_status extend_video lip_sync_video sound_effect_video'],
  },
  {
    key: 'model',
    typeLabel: 'enum',
    value: 'v4.5 | v5',
    responsibility: 'PixVerse model family supported by the shipped local adapter.',
    notes: 'Knowgrph defaults to `v5` and keeps the value configurable through environment variables for local runs.',
    searchHints: ['v4.5 v5 model pixverse'],
  },
  {
    key: 'duration',
    typeLabel: 'enum',
    value: '5 | 8',
    responsibility: 'Allowed PixVerse generation durations from the upstream tool contract.',
    notes: 'Knowgrph normalizes duration to 5s or 8s to match the upstream MCP tool contract.',
    searchHints: ['duration 5 8 seconds'],
  },
  {
    key: 'quality',
    typeLabel: 'enum',
    value: '360p | 540p | 720p | 1080p',
    responsibility: 'Video quality passed through to PixVerse generation tools.',
    searchHints: ['quality 540p 720p 1080p'],
  },
  {
    key: 'motion_mode',
    typeLabel: 'enum',
    value: 'normal | fast',
    responsibility: 'Motion mode passed through to PixVerse image-conditioned and text-based generation tools.',
    searchHints: ['motion_mode normal fast'],
  },
  {
    key: 'reference_image_flow',
    typeLabel: 'string',
    value: 'Knowgrph preserves the shared image widget output, then synthesizes upload-safe PNG derivatives for PixVerse when the local reference image is not already jpg/png/webp.',
    responsibility: 'Explains how the shipped adapter avoids changing renderer contracts while satisfying PixVerse upload requirements.',
    searchHints: ['reference image png derivative svg upload-safe'],
  },
  {
    key: 'transition_flow',
    typeLabel: 'string',
    value: 'Multi-scene plans derive transition-aware prompts and a synthesized last-frame upload so PixVerse transition_video can connect scenes without introducing a second canvas schema.',
    responsibility: 'Explains the transition-video additive path for multi-scene narrative plans.',
    searchHints: ['transition flow multi-scene transition prompt'],
  },
  {
    key: 'fusion_flow',
    typeLabel: 'string',
    value: 'Optional fusion_video generation composes the shared reference image with synthesized world/support PNG references, then submits one fused PixVerse clip without creating a second widget or renderer contract.',
    responsibility: 'Explains the constrained fusion-video path for the current harness slice.',
    notes: 'The current safe slice derives a hero/world/support reference set upstream and normalizes the model to `v4.5` for the fusion tool contract.',
    searchHints: ['fusion_video hero world support v4.5'],
  },
  {
    key: 'extension_flow',
    typeLabel: 'string',
    value: 'Longer narrative runs can chain extend_video after the initial PixVerse generation, keeping a bounded continuation count and preserving one shared video widget contract.',
    responsibility: 'Explains the extend-video additive path for longer sequences.',
    searchHints: ['extend_video continuation longer sequence bounded extension'],
  },
  {
    key: 'lip_sync_flow',
    typeLabel: 'string',
    value: 'Optional lip_sync_video post-processing can attach either TTS narration or uploaded custom audio to a generated PixVerse clip via source_video_id or an uploaded PixVerse video_media_id, while keeping one shared video widget and renderer contract.',
    responsibility: 'Explains the additive lip-sync path for already-generated PixVerse clips.',
    notes: 'This row documents upstream PixVerse MCP capability shape only; SuperAgent does not route through PixVerse.',
    searchHints: ['lip_sync_video tts speaker audio_media_id source_video_id video_media_id local upload'],
  },
  {
    key: 'sound_effect_flow',
    typeLabel: 'string',
    value: 'Optional sound_effect_video post-processing can attach contextual audio to either the final generated PixVerse clip using source_video_id or an uploaded PixVerse video_media_id, while keeping one shared video widget and renderer contract.',
    responsibility: 'Explains the additive sound-effect path for already-generated PixVerse clips.',
    notes: 'This row documents upstream PixVerse MCP capability shape only; SuperAgent does not route through PixVerse.',
    searchHints: ['sound_effect_video contextual audio original sound switch video_media_id local upload'],
  },
  {
    key: 'docs_url',
    typeLabel: 'string',
    value: PIXVERSE_VIDEO_GENERATION_API_DOCS_URL,
    responsibility: 'Reference URL for the upstream PixVerse MCP project and tool contract.',
    searchHints: ['PixVerse MCP docs GitHub'],
  },
]

export const PIXVERSE_VIDEO_GENERATION_API_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  PIXVERSE_VIDEO_GENERATION_DOC_ROWS.map(row => ({
    meta: {
      key: `pixverseVideoApi.${row.key}`,
      type: toBaseType(row.typeLabel),
      source: 'backendEnv',
      read: () => row.value,
    },
    value: row.value,
    typeLabel: row.typeLabel,
    searchHints: ['pixverse video generation mcp readiness', row.key, ...(row.searchHints || [])],
    details: {
      area: PIXVERSE_VIDEO_GENERATION_API_DOC_AREA,
      responsibility: row.responsibility,
      notes: String(row.notes || '').trim(),
      modules: ['canvas/src/features/integrations/pixverseVideoGenerationSsot.ts'],
      classes: [],
      functions: [],
    } satisfies FlowDetails,
  }))
