import React from 'react'
import {
  ArrowRightLeft,
  BarChart3,
  Braces,
  CalendarClock,
  Copy,
  CreditCard,
  Eraser,
  GitBranch,
  Hand,
  Hash,
  HelpCircle,
  History as HistoryIcon,
  LayoutGrid,
  Link2,
  ListChecks,
  LocateFixed,
  Map as MapIcon,
  MessageCircle,
  MonitorPlay,
  Palette,
  Plug,
  PlugZap,
  Radio,
  Server,
  Settings,
  SlidersHorizontal,
  SquareCheckBig,
  Table,
  Type as TextTypeIcon,
  UserX,
  Users,
} from 'lucide-react'
import type { MainPanelTabKey } from '@/features/panels/mainPanelTabs'

export type MainPanelTypeIconComponent = React.ComponentType<{
  className?: string
  strokeWidth?: number | string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

export type MainPanelTypeIconKey =
  | 'collaboration.peer'
  | 'collaboration.session'
  | 'collaboration.runtime'
  | 'collaboration.transport'
  | 'collaboration.follow'
  | 'collaboration.connection'
  | 'collaboration.link'
  | 'collaboration.copy'
  | 'collaboration.removePeer'
  | 'setting.text'
  | 'setting.number'
  | 'setting.boolean'
  | 'setting.object'
  | 'setting.list'
  | 'setting.dateTime'
  | 'setting.url'
  | 'action.clear'
  | 'mainPanel.collaboration'
  | 'mainPanel.integrations'
  | 'mainPanel.mcp'
  | 'mainPanel.maps'
  | 'mainPanel.payments'
  | 'mainPanel.design'
  | 'mainPanel.workflowManager'
  | 'mainPanel.dashboard'
  | 'mainPanel.preview'
  | 'mainPanel.settings'
  | 'mainPanel.history'
  | 'mainPanel.help'
  | 'floatingPanel.propsPanel'
  | 'floatingPanel.view'
  | 'floatingPanel.interaction'
  | 'floatingPanel.design'
  | 'floatingPanel.chat'
  | 'floatingPanel.geo'
  | 'floatingPanel.renderer'
  | 'floatingPanel.graphTraversal'

export type MainPanelTypeIconMeta = Readonly<{
  category: string
  label: string
  agentic: string
  usage: string
  Icon: MainPanelTypeIconComponent
}>

export const MAIN_PANEL_TYPE_ICON_META_BY_KEY = {
  'collaboration.peer': {
    category: 'Collaboration type',
    label: 'Peer / roster',
    agentic: 'Remote actor',
    usage: 'Identifies participants, peer count, ownership rows, and local/remote presence.',
    Icon: Users,
  },
  'collaboration.session': {
    category: 'Collaboration type',
    label: 'Session state',
    agentic: 'Shared runtime state',
    usage: 'Marks the active host/guest session, role, phase, and session identifiers.',
    Icon: Radio,
  },
  'collaboration.runtime': {
    category: 'Collaboration type',
    label: 'Runtime ready',
    agentic: 'Connected operation',
    usage: 'Marks live runtime status, successful handshakes, and connected transport paths.',
    Icon: PlugZap,
  },
  'collaboration.transport': {
    category: 'Collaboration type',
    label: 'Transport pending',
    agentic: 'Disconnected operation',
    usage: 'Marks transport rows before the peer channel is connected.',
    Icon: Plug,
  },
  'collaboration.follow': {
    category: 'Collaboration type',
    label: 'Follow target',
    agentic: 'Attention routing',
    usage: 'Marks cursor-follow and peer-target selection rows.',
    Icon: LocateFixed,
  },
  'collaboration.connection': {
    category: 'Collaboration type',
    label: 'Handshake / exchange',
    agentic: 'Bidirectional transfer',
    usage: 'Marks host, join, answer, and peer connection actions.',
    Icon: ArrowRightLeft,
  },
  'collaboration.link': {
    category: 'Collaboration type',
    label: 'Invite link',
    agentic: 'Shareable reference',
    usage: 'Marks invite URLs, endpoints, and external reference values.',
    Icon: Link2,
  },
  'collaboration.copy': {
    category: 'Collaboration type',
    label: 'Copy artifact',
    agentic: 'Portable payload',
    usage: 'Marks copyable invite and answer tokens.',
    Icon: Copy,
  },
  'collaboration.removePeer': {
    category: 'Collaboration type',
    label: 'Remove peer',
    agentic: 'Roster mutation',
    usage: 'Marks owner-only peer removal actions.',
    Icon: UserX,
  },
  'setting.text': {
    category: 'Setting value type',
    label: 'Text',
    agentic: 'String scalar',
    usage: 'Marks plain text, provider names, model names, prompts, and enum-like values.',
    Icon: TextTypeIcon,
  },
  'setting.number': {
    category: 'Setting value type',
    label: 'Number',
    agentic: 'Numeric scalar',
    usage: 'Marks integer, decimal, duration, limit, and ratio settings.',
    Icon: Hash,
  },
  'setting.boolean': {
    category: 'Setting value type',
    label: 'Boolean',
    agentic: 'Binary flag',
    usage: 'Marks on/off controls, readiness flags, and confirmation toggles.',
    Icon: SquareCheckBig,
  },
  'setting.object': {
    category: 'Setting value type',
    label: 'Object / JSON',
    agentic: 'Structured payload',
    usage: 'Marks JSON, object, request body, response format, and config-map settings.',
    Icon: Braces,
  },
  'setting.list': {
    category: 'Setting value type',
    label: 'List',
    agentic: 'Ordered values',
    usage: 'Marks arrays, multi-select options, and route/tool collections.',
    Icon: ListChecks,
  },
  'setting.dateTime': {
    category: 'Setting value type',
    label: 'Date / time',
    agentic: 'Temporal scalar',
    usage: 'Marks timestamp, schedule, and expiry values.',
    Icon: CalendarClock,
  },
  'setting.url': {
    category: 'Setting value type',
    label: 'URL / endpoint',
    agentic: 'External reference',
    usage: 'Marks endpoint URLs, docs URLs, routes, and hosted asset references.',
    Icon: Link2,
  },
  'action.clear': {
    category: 'Action type',
    label: 'Clear / reset',
    agentic: 'Non-destructive erase',
    usage: 'Marks reset and clear actions that do not remove underlying graph data.',
    Icon: Eraser,
  },
  'mainPanel.collaboration': {
    category: 'MainPanel surface',
    label: 'Collaboration',
    agentic: 'Peer session surface',
    usage: 'MainPanel tab for owner/guest peer sessions, invites, and roster state.',
    Icon: Users,
  },
  'mainPanel.integrations': {
    category: 'MainPanel surface',
    label: 'Integrations',
    agentic: 'Provider configuration',
    usage: 'MainPanel tab for chat, model, image, video, and provider API settings.',
    Icon: Plug,
  },
  'mainPanel.mcp': {
    category: 'MainPanel surface',
    label: 'MCP',
    agentic: 'Tool configuration',
    usage: 'MainPanel tab for browser, crawler, provider, and payment MCP readiness.',
    Icon: Server,
  },
  'mainPanel.maps': {
    category: 'MainPanel surface',
    label: 'Maps',
    agentic: 'Geospatial configuration',
    usage: 'MainPanel tab for map providers, directions, and GeoJSON settings.',
    Icon: MapIcon,
  },
  'mainPanel.payments': {
    category: 'MainPanel surface',
    label: 'Payments',
    agentic: 'Payment configuration',
    usage: 'MainPanel tab for Stripe and payment readiness settings.',
    Icon: CreditCard,
  },
  'mainPanel.design': {
    category: 'MainPanel surface',
    label: 'Design',
    agentic: 'Design surface',
    usage: 'MainPanel tab for design renderer and page/component inspection.',
    Icon: Palette,
  },
  'mainPanel.workflowManager': {
    category: 'MainPanel surface',
    label: 'Workflow Manager',
    agentic: 'Workflow curation',
    usage: 'MainPanel tab for graph fields, mappings, and workflow registry management.',
    Icon: Table,
  },
  'mainPanel.dashboard': {
    category: 'MainPanel surface',
    label: 'Dashboard',
    agentic: 'Surface summary',
    usage: 'MainPanel tab for runtime status and dashboard metrics.',
    Icon: BarChart3,
  },
  'mainPanel.preview': {
    category: 'MainPanel surface',
    label: 'Preview Panel',
    agentic: 'Rendered preview',
    usage: 'MainPanel tab for previewing rendered output.',
    Icon: MonitorPlay,
  },
  'mainPanel.settings': {
    category: 'MainPanel surface',
    label: 'Settings',
    agentic: 'Shared settings',
    usage: 'MainPanel tab for all settings rows and settings-derived hub views.',
    Icon: Settings,
  },
  'mainPanel.history': {
    category: 'MainPanel surface',
    label: 'History',
    agentic: 'Event review',
    usage: 'MainPanel tab for history and log review.',
    Icon: HistoryIcon,
  },
  'mainPanel.help': {
    category: 'MainPanel surface',
    label: 'Help',
    agentic: 'Operator reference',
    usage: 'MainPanel tab for shortcuts, workflow links, panel tour, and icon library.',
    Icon: HelpCircle,
  },
  'floatingPanel.propsPanel': {
    category: 'FloatingPanel surface',
    label: 'Props Panel',
    agentic: 'Selection properties',
    usage: 'FloatingPanel view for node, edge, widget, and media properties.',
    Icon: SlidersHorizontal,
  },
  'floatingPanel.view': {
    category: 'FloatingPanel surface',
    label: 'View',
    agentic: 'Data view controls',
    usage: 'FloatingPanel view for workspace data-view settings.',
    Icon: LayoutGrid,
  },
  'floatingPanel.interaction': {
    category: 'FloatingPanel surface',
    label: 'Interaction',
    agentic: 'Canvas controls',
    usage: 'FloatingPanel view for pointer, pan, zoom, and interaction settings.',
    Icon: Hand,
  },
  'floatingPanel.design': {
    category: 'FloatingPanel surface',
    label: 'Design',
    agentic: 'Design controls',
    usage: 'FloatingPanel view for design layers, inspector, tokens, and DOM views.',
    Icon: Palette,
  },
  'floatingPanel.chat': {
    category: 'FloatingPanel surface',
    label: 'Chat',
    agentic: 'Assistant interface',
    usage: 'FloatingPanel view for chat runs and KGC output creation.',
    Icon: MessageCircle,
  },
  'floatingPanel.geo': {
    category: 'FloatingPanel surface',
    label: 'Geo',
    agentic: 'Map interaction',
    usage: 'FloatingPanel view for geospatial inspection and map interaction.',
    Icon: MapIcon,
  },
  'floatingPanel.renderer': {
    category: 'FloatingPanel surface',
    label: 'Renderer',
    agentic: 'Rendering controls',
    usage: 'FloatingPanel view for renderer presets and visualization controls.',
    Icon: MonitorPlay,
  },
  'floatingPanel.graphTraversal': {
    category: 'FloatingPanel surface',
    label: 'Graph Traversal',
    agentic: 'Path reasoning',
    usage: 'FloatingPanel view for graph traversal and orchestrator workflow controls.',
    Icon: GitBranch,
  },
} satisfies Record<MainPanelTypeIconKey, MainPanelTypeIconMeta>

export const MAIN_PANEL_TAB_TYPE_ICON_KEY_BY_TAB = {
  collaboration: 'mainPanel.collaboration',
  integrations: 'mainPanel.integrations',
  mcp: 'mainPanel.mcp',
  maps: 'mainPanel.maps',
  payments: 'mainPanel.payments',
  design: 'mainPanel.design',
  workflowManager: 'mainPanel.workflowManager',
  dashboard: 'mainPanel.dashboard',
  preview: 'mainPanel.preview',
  settings: 'mainPanel.settings',
  history: 'mainPanel.history',
  help: 'mainPanel.help',
} satisfies Record<MainPanelTabKey, MainPanelTypeIconKey>

export const MAIN_PANEL_TAB_TYPE_ICON_BY_KEY: Record<MainPanelTabKey, MainPanelTypeIconComponent> = {
  collaboration: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.collaboration'].Icon,
  integrations: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.integrations'].Icon,
  mcp: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.mcp'].Icon,
  maps: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.maps'].Icon,
  payments: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.payments'].Icon,
  design: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.design'].Icon,
  workflowManager: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.workflowManager'].Icon,
  dashboard: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.dashboard'].Icon,
  preview: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.preview'].Icon,
  settings: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.settings'].Icon,
  history: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.history'].Icon,
  help: MAIN_PANEL_TYPE_ICON_META_BY_KEY['mainPanel.help'].Icon,
}

export type FloatingPanelTypeIconView =
  | 'propsPanel'
  | 'view'
  | 'interaction'
  | 'design'
  | 'chat'
  | 'geo'
  | 'renderer'
  | 'graphTraversal'

export const FLOATING_PANEL_TYPE_ICON_KEY_BY_VIEW = {
  propsPanel: 'floatingPanel.propsPanel',
  view: 'floatingPanel.view',
  interaction: 'floatingPanel.interaction',
  design: 'floatingPanel.design',
  chat: 'floatingPanel.chat',
  geo: 'floatingPanel.geo',
  renderer: 'floatingPanel.renderer',
  graphTraversal: 'floatingPanel.graphTraversal',
} satisfies Record<FloatingPanelTypeIconView, MainPanelTypeIconKey>

export const FLOATING_PANEL_TYPE_ICON_BY_VIEW: Record<FloatingPanelTypeIconView, MainPanelTypeIconComponent> = {
  propsPanel: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.propsPanel'].Icon,
  view: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.view'].Icon,
  interaction: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.interaction'].Icon,
  design: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.design'].Icon,
  chat: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.chat'].Icon,
  geo: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.geo'].Icon,
  renderer: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.renderer'].Icon,
  graphTraversal: MAIN_PANEL_TYPE_ICON_META_BY_KEY['floatingPanel.graphTraversal'].Icon,
}

export const MAIN_PANEL_HELP_TYPE_ICON_KEYS = [
  'mainPanel.collaboration',
  'mainPanel.integrations',
  'mainPanel.mcp',
  'mainPanel.maps',
  'mainPanel.payments',
  'mainPanel.settings',
  'floatingPanel.propsPanel',
  'floatingPanel.view',
  'floatingPanel.chat',
  'floatingPanel.geo',
  'floatingPanel.renderer',
  'floatingPanel.graphTraversal',
  'collaboration.peer',
  'collaboration.session',
  'collaboration.runtime',
  'collaboration.transport',
  'collaboration.connection',
  'collaboration.link',
  'collaboration.copy',
  'collaboration.follow',
  'setting.text',
  'setting.number',
  'setting.boolean',
  'setting.object',
  'setting.list',
  'setting.url',
  'setting.dateTime',
  'action.clear',
] as const satisfies readonly MainPanelTypeIconKey[]

export function getMainPanelTypeIconMeta(iconKey: MainPanelTypeIconKey): MainPanelTypeIconMeta {
  return MAIN_PANEL_TYPE_ICON_META_BY_KEY[iconKey]
}

export function resolveMainPanelSettingTypeIconKey(typeLabel: string): MainPanelTypeIconKey {
  const normalized = String(typeLabel || '').trim().toLowerCase()
  if (!normalized) return 'setting.text'
  if (
    normalized.includes('url')
    || normalized.includes('uri')
    || normalized.includes('endpoint')
    || normalized.includes('route')
    || normalized.includes('link')
  ) {
    return 'setting.url'
  }
  if (
    normalized.includes('date')
    || normalized.includes('time')
    || normalized.includes('ttl')
    || normalized.includes('expiry')
    || normalized.includes('schedule')
  ) {
    return 'setting.dateTime'
  }
  if (
    normalized.includes('array')
    || normalized.includes('list')
    || normalized.includes('multi-select')
    || normalized.includes('collection')
  ) {
    return 'setting.list'
  }
  if (
    normalized.includes('object')
    || normalized.includes('json')
    || normalized.includes('body')
    || normalized.includes('payload')
    || normalized.includes('config')
  ) {
    return 'setting.object'
  }
  if (
    normalized.includes('bool')
    || normalized.includes('checkbox')
    || normalized.includes('toggle')
    || normalized.includes('flag')
  ) {
    return 'setting.boolean'
  }
  if (
    normalized.includes('number')
    || normalized.includes('int')
    || normalized.includes('integer')
    || normalized.includes('float')
    || normalized.includes('decimal')
    || normalized.includes('currency')
    || normalized.includes('ratio')
    || normalized.includes('duration')
    || normalized.includes('limit')
  ) {
    return 'setting.number'
  }
  return 'setting.text'
}

export function MainPanelTypeIcon({
  iconKey,
  className,
  strokeWidth,
  ariaHidden = true,
}: {
  iconKey: MainPanelTypeIconKey
  className?: string
  strokeWidth?: number | string
  ariaHidden?: boolean | 'true' | 'false'
}) {
  const Icon = MAIN_PANEL_TYPE_ICON_META_BY_KEY[iconKey].Icon
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
}
