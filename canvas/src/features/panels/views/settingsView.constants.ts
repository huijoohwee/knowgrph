import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils'
import { FLOW_IMAGE_GENERATION_NODE_LABEL, FLOW_VIDEO_GENERATION_NODE_LABEL } from '@/lib/config.flow-editor'
import { settingsRegistry } from '@/features/settings/registry'
import { getGrabMapsDiscoveryWidgetLabel } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { BYTEPLUS_SHARED_TEXT_API_DOC_AREA } from './byteplusSharedTextApiDocs'
import { OPENAI_CHAT_API_DOC_AREA } from './openaiChatApiDocs'
import { OPENAI_IMAGES_API_DOC_AREA } from './openaiImagesApiDocs'
import { DEERFLOW_API_DOC_AREA } from './deerflowApiDocs'
import { BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA, BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL } from '@/features/integrations/byteplusImageGenerationSsot'
import { BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA, BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL } from '@/features/integrations/byteplusVideoGenerationSsot'
import { GEMINI_VIDEO_GENERATION_API_DOC_AREA, GEMINI_VIDEO_GENERATION_API_DOCS_URL } from '@/features/integrations/geminiVideoGenerationSsot'
import { MAPS_GEO_DOC_AREA, MAPS_MAPLIBRE_DOC_AREA, MAPS_GRABMAPS_DOC_AREA } from './mapsApiDocs'
import { MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA } from './grabmapsDirectionsApiDocs'
import { MAPS_GRABMAPS_MCP_DOC_AREA } from './grabmapsMcpApiDocs'
import { API_NATIVE_BROWSER_MCP_DOC_AREA } from './apiNativeBrowserMcpApiDocs'

export const SETTINGS_REGISTRY_BY_KEY = new Map(settingsRegistry.map(setting => [setting.key, setting] as const))
export const ACTIVE_WORKSPACE_SYNC_MAX_ATTEMPTS = 8
export const ACTIVE_WORKSPACE_SYNC_RETRY_MS = 250

export type SectionMeta = Readonly<{
  docsUrl?: string
  docsLabel?: string
  panelLabel: string
  note?: string
  highlights?: readonly string[]
  openPanel: () => void
}>

export const CHAT_KTV_ROW_KEYS = {
  apiKey: 'chatApiKey',
  provider: 'chatProvider',
  contextScope: 'chatContextScope',
  routing: 'integrationConfigsJson',
  model: 'chatModel',
} as const

const VIDEO_INTEGRATION_TRAVEL_PIPELINE_HIGHLIGHTS = [
  'Travel-planning video prompts can reuse GrabMaps-selected geojson plus place search context from Props Panel Discovery Widget, while MainPanel MCP keeps backend/system/API/MCP config.',
  'Output stays on the shared widget -> edge -> Rich Media Panel pipeline for inline video rendering.',
] as const

export const INTEGRATIONS_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  Chat: {
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitSidePanelOpen({ tab: 'chat', open: true }),
  },
  [BYTEPLUS_SHARED_TEXT_API_DOC_AREA]: {
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk/1494384',
    docsLabel: 'Open BytePlus Text API Docs',
    panelLabel: 'Open FloatingPanel Props Panel Text Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  [OPENAI_CHAT_API_DOC_AREA]: {
    docsUrl: 'https://developers.openai.com/api/reference/resources/responses',
    docsLabel: 'Open OpenAI Chat API Docs',
    panelLabel: 'Open FloatingPanel Props Panel OpenAI Text Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  [OPENAI_IMAGES_API_DOC_AREA]: {
    docsUrl: 'https://developers.openai.com/api/reference/resources/images',
    docsLabel: 'Open OpenAI Images API Docs',
    panelLabel: 'Open FloatingPanel Props Panel OpenAI Image Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  [DEERFLOW_API_DOC_AREA]: {
    docsUrl: 'https://github.com/bytedance/deer-flow',
    docsLabel: 'Open DeerFlow Docs',
    panelLabel: 'Open FloatingPanel Props Panel DeerFlow Text Widget',
    openPanel: () => emitPropsPanelOpen(),
  },
  [BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA]: {
    docsUrl: BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL,
    docsLabel: 'Open BytePlus Video Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_VIDEO_GENERATION_NODE_LABEL}`,
    note: 'Uses shared BytePlus auth_mode and api_key from BytePlus Shared + Text API.',
    highlights: VIDEO_INTEGRATION_TRAVEL_PIPELINE_HIGHLIGHTS,
    openPanel: () => emitPropsPanelOpen(),
  },
  [GEMINI_VIDEO_GENERATION_API_DOC_AREA]: {
    docsUrl: GEMINI_VIDEO_GENERATION_API_DOCS_URL,
    docsLabel: 'Open Gemini Veo Video Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_VIDEO_GENERATION_NODE_LABEL}`,
    note: 'Uses shared Gemini video defaults and the common widget -> edge -> Rich Media Panel output path.',
    openPanel: () => emitPropsPanelOpen(),
  },
  [BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA]: {
    docsUrl: BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL,
    docsLabel: 'Open BytePlus Image Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_IMAGE_GENERATION_NODE_LABEL}`,
    note: 'Uses shared BytePlus auth_mode and api_key from BytePlus Shared + Text API.',
    openPanel: () => emitPropsPanelOpen(),
  },
}

export const MCP_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  [API_NATIVE_BROWSER_MCP_DOC_AREA]: {
    docsUrl: 'https://github.com/unbrowse-ai/unbrowse',
    docsLabel: 'Open API-Native Browser MCP Reference',
    panelLabel: 'Open FloatingPanel Chat UI',
    note: 'Generic MCP bridge for local browser API route discovery and execution.',
    highlights: [
      'Route cache, native browser actions, loopback runtime URL, dry-run, unsafe-action, third-party terms, and cookie-import confirmation stay configurable in MainPanel MCP.',
    ],
    openPanel: () => emitSidePanelOpen({ tab: 'chat', open: true }),
  },
  [MAPS_GRABMAPS_MCP_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation/mcp',
    docsLabel: 'Open GrabMaps MCP Docs',
    panelLabel: `Open FloatingPanel Props Panel ${getGrabMapsDiscoveryWidgetLabel()}`,
    openPanel: () => emitPropsPanelOpen(),
  }
}

export const MAPS_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  [MAPS_GRABMAPS_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation',
    docsLabel: 'Open GrabMaps Docs',
    panelLabel: 'Open FloatingPanel Geo',
    note: 'MainPanel Maps remains backend/system/API-facing for GrabMaps auth, style, and route configuration.',
    highlights: [
      'Style loading uses Bearer auth against https://maps.grab.com/api/style.json.',
    ],
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation/routes',
    docsLabel: 'Open GrabMaps Routes Docs',
    panelLabel: 'Open FloatingPanel Geo',
    note: 'Directions default to lng,lat coordinate order unless lat_first is enabled.',
    highlights: [
      'Use overview=full when you need route geometry suitable for animation or media prompts.',
    ],
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GEO_DOC_AREA]: {
    docsUrl: 'https://datatracker.ietf.org/doc/html/rfc7946',
    docsLabel: 'Open GeoJSON RFC 7946',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_MAPLIBRE_DOC_AREA]: {
    docsUrl: 'https://maplibre.org/maplibre-gl-js/docs/',
    docsLabel: 'Open MapLibre GL JS Docs',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitSidePanelOpen({ tab: 'geo', open: true }),
  },
}
