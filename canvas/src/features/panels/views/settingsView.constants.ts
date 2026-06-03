import { emitPropsPanelOpen, emitFloatingPanelOpen } from '@/features/canvas/utils'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import { FLOW_IMAGE_GENERATION_NODE_LABEL, FLOW_VIDEO_GENERATION_NODE_LABEL } from '@/lib/config.flow-editor'
import { settingsRegistry } from '@/features/settings/registry'
import { getGrabMapsDiscoveryWidgetLabel } from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { BYTEPLUS_SHARED_TEXT_API_DOC_AREA } from './byteplusSharedTextApiDocs'
import { OPENAI_CHAT_API_DOC_AREA } from './openaiChatApiDocs'
import { OPENAI_IMAGES_API_DOC_AREA } from './openaiImagesApiDocs'
import { DEERFLOW_API_DOC_AREA } from './deerflowApiDocs'
import { MIROMIND_API_DOC_AREA, MIROMIND_API_DOCS_URL } from './miromindApiDocs'
import { AGNES_API_DOC_AREA, AGNES_API_DOCS_URL } from './agnesApiDocs'
import { BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA, BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL } from '@/features/integrations/byteplusImageGenerationSsot'
import { BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA, BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL } from '@/features/integrations/byteplusVideoGenerationSsot'
import { GEMINI_VIDEO_GENERATION_API_DOC_AREA, GEMINI_VIDEO_GENERATION_API_DOCS_URL } from '@/features/integrations/geminiVideoGenerationSsot'
import { PIXVERSE_VIDEO_GENERATION_API_DOC_AREA, PIXVERSE_VIDEO_GENERATION_API_DOCS_URL } from '@/features/integrations/pixverseVideoGenerationSsot'
import { MAPS_GEO_DOC_AREA, MAPS_MAPLIBRE_DOC_AREA, MAPS_GRABMAPS_DOC_AREA } from './mapsApiDocs'
import { MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA } from './grabmapsDirectionsApiDocs'
import { MAPS_GRABMAPS_MCP_DOC_AREA } from './grabmapsMcpApiDocs'
import { API_NATIVE_BROWSER_MCP_DOC_AREA } from './apiNativeBrowserMcpApiDocs'
import { EXA_MCP_DOC_AREA, EXA_MCP_DOCS_URL } from './exaMcpApiDocs'
import { STRIPE_MCP_DOC_AREA } from './stripeMcpApiDocs'
import { PIXVERSE_MCP_DOC_AREA, PIXVERSE_MCP_DOCS_URL } from './pixverseMcpApiDocs'
import { MIROMIND_MCP_DOC_AREA, MIROMIND_MCP_DOCS_URL } from './miromindMcpApiDocs'
import { KNOWGRPH_VDEOXPLN_DOC_AREA } from './vdeoxplnMcpApiDocs'
import { STRIPE_MCP_DOCS_URL } from 'grph-shared/payments/stripeMcpSsot'

export const SETTINGS_REGISTRY_BY_KEY = new Map(settingsRegistry.map(setting => [setting.key, setting] as const))
export const ACTIVE_WORKSPACE_SYNC_MAX_ATTEMPTS = 8
export const ACTIVE_WORKSPACE_SYNC_RETRY_MS = 250

export type SectionMeta = Readonly<{
  docsUrl?: string
  docsLabel?: string
  panelLabel: string
  openPanel: () => void
}>

export const CHAT_KTV_ROW_KEYS = {
  apiKey: 'chatApiKey',
  provider: 'chatProvider',
  contextScope: 'chatContextScope',
  routing: 'integrationConfigsJson',
  model: 'chatModel',
} as const

export const INTEGRATIONS_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  Chat: {
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
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
  [MIROMIND_API_DOC_AREA]: {
    docsUrl: MIROMIND_API_DOCS_URL,
    docsLabel: 'Open MiroMind Chat Completions Docs',
    panelLabel: 'Open FloatingPanel Chat UI (MiroMind)',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [AGNES_API_DOC_AREA]: {
    docsUrl: AGNES_API_DOCS_URL,
    docsLabel: 'Open Agnes AI Chat Completions Docs',
    panelLabel: 'Open FloatingPanel Chat UI (Agnes)',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [BYTEPLUS_VIDEO_GENERATION_API_DOC_AREA]: {
    docsUrl: BYTEPLUS_VIDEO_GENERATION_API_DOCS_URL,
    docsLabel: 'Open BytePlus Video Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_VIDEO_GENERATION_NODE_LABEL}`,
    openPanel: () => emitPropsPanelOpen(),
  },
  [GEMINI_VIDEO_GENERATION_API_DOC_AREA]: {
    docsUrl: GEMINI_VIDEO_GENERATION_API_DOCS_URL,
    docsLabel: 'Open Gemini Veo Video Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_VIDEO_GENERATION_NODE_LABEL}`,
    openPanel: () => emitPropsPanelOpen(),
  },
  [PIXVERSE_VIDEO_GENERATION_API_DOC_AREA]: {
    docsUrl: PIXVERSE_VIDEO_GENERATION_API_DOCS_URL,
    docsLabel: 'Open PixVerse Video Generation Docs',
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [BYTEPLUS_IMAGE_GENERATION_API_DOC_AREA]: {
    docsUrl: BYTEPLUS_IMAGE_GENERATION_API_DOCS_URL,
    docsLabel: 'Open BytePlus Image Generation API Docs',
    panelLabel: `Open FloatingPanel ${FLOW_IMAGE_GENERATION_NODE_LABEL}`,
    openPanel: () => emitPropsPanelOpen(),
  },
}

export const MCP_SECTION_META: Readonly<Record<string, SectionMeta>> = {
  [API_NATIVE_BROWSER_MCP_DOC_AREA]: {
    docsUrl: 'https://github.com/unbrowse-ai/unbrowse',
    docsLabel: 'Open API-Native Browser MCP Reference',
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [EXA_MCP_DOC_AREA]: {
    docsUrl: EXA_MCP_DOCS_URL,
    docsLabel: 'Open Exa MCP Docs',
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [STRIPE_MCP_DOC_AREA]: {
    docsUrl: STRIPE_MCP_DOCS_URL,
    docsLabel: 'Open Stripe MCP Docs',
    panelLabel: 'Open MainPanel Commerce',
    openPanel: () => emitMainPanelOpen({ tab: 'commerce', searchQuery: 'stripeApi.checkout' }),
  },
  [PIXVERSE_MCP_DOC_AREA]: {
    docsUrl: PIXVERSE_MCP_DOCS_URL,
    docsLabel: 'Open PixVerse MCP Docs',
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [MIROMIND_MCP_DOC_AREA]: {
    docsUrl: MIROMIND_MCP_DOCS_URL,
    docsLabel: 'Open MiroMind MCP Docs',
    panelLabel: 'Open FloatingPanel Chat UI (MiroMind)',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
  },
  [KNOWGRPH_VDEOXPLN_DOC_AREA]: {
    docsUrl: '/knowgrph/.well-known/agent-skills/index.json',
    docsLabel: 'Open Agent Skills Index',
    panelLabel: 'Open FloatingPanel Chat UI',
    openPanel: () => emitFloatingPanelOpen({ tab: 'chat', open: true }),
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
    openPanel: () => emitFloatingPanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GRABMAPS_DIRECTIONS_REQUEST_DOC_AREA]: {
    docsUrl: 'https://maps.grab.com/developer/documentation/routes',
    docsLabel: 'Open GrabMaps Routes Docs',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitFloatingPanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_GEO_DOC_AREA]: {
    docsUrl: 'https://datatracker.ietf.org/doc/html/rfc7946',
    docsLabel: 'Open GeoJSON RFC 7946',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitFloatingPanelOpen({ tab: 'geo', open: true }),
  },
  [MAPS_MAPLIBRE_DOC_AREA]: {
    docsUrl: 'https://maplibre.org/maplibre-gl-js/docs/',
    docsLabel: 'Open MapLibre GL JS Docs',
    panelLabel: 'Open FloatingPanel Geo',
    openPanel: () => emitFloatingPanelOpen({ tab: 'geo', open: true }),
  },
}
