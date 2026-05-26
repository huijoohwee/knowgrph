import { normalized as normalizeText } from '@/features/panels/utils/json'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { GRABMAPS_MCP_REQUEST_DOC_ENTRIES, getGrabMapsMcpApiRowAnchorId } from './grabmapsMcpApiDocs'
import {
  API_NATIVE_BROWSER_MCP_AGENT_CONFIG_KEY,
  API_NATIVE_BROWSER_MCP_BRIDGE_CONFIG_KEY,
  API_NATIVE_BROWSER_MCP_DOC_AREA,
  API_NATIVE_BROWSER_MCP_DOC_ENTRIES,
  buildApiNativeBrowserMcpAgentConfigJson,
  buildBrowserBridgeMcpConfigJson,
  getApiNativeBrowserMcpApiRowAnchorId,
} from './apiNativeBrowserMcpApiDocs'
import {
  CRAWLER_ACCESS_MCP_DOC_AREA,
  CRAWLER_ACCESS_MCP_DOC_ENTRIES,
  getCrawlerAccessMcpApiRowAnchorId,
} from './crawlerAccessMcpApiDocs'
import {
  STRIPE_MCP_DOC_AREA,
  STRIPE_MCP_DOC_ENTRIES,
  STRIPE_MCP_LOCAL_CONFIG_KEY,
  STRIPE_MCP_REMOTE_CONFIG_KEY,
  buildStripeLocalMcpConfigJson,
  buildStripeRemoteMcpConfigJson,
  getStripeMcpApiRowAnchorId,
} from './stripeMcpApiDocs'
import {
  PIXVERSE_MCP_DOC_AREA,
  PIXVERSE_MCP_DOC_ENTRIES,
  PIXVERSE_MCP_LOCAL_CONFIG_KEY,
  buildPixVerseLocalMcpConfigJson,
  getPixVerseMcpApiRowAnchorId,
} from './pixverseMcpApiDocs'
import {
  buildDocMappedEntry,
  isMcpOwnedSetting,
  normalizeSettingsAreaLabel,
  type SettingsEntry,
} from './useSettingsView.helpers'

export function buildMcpDocEntries(
  mapsAndMcpDocEntries: ReadonlyArray<VirtualSettingsEntry>,
): ReadonlyArray<VirtualSettingsEntry> {
  return [
    ...API_NATIVE_BROWSER_MCP_DOC_ENTRIES,
    ...CRAWLER_ACCESS_MCP_DOC_ENTRIES,
    ...STRIPE_MCP_DOC_ENTRIES,
    ...PIXVERSE_MCP_DOC_ENTRIES,
    ...mapsAndMcpDocEntries.filter(entry => isMcpOwnedSetting(entry.meta.key, entry.details.area)),
    ...GRABMAPS_MCP_REQUEST_DOC_ENTRIES,
  ]
}

export function buildMcpVirtualEntry(
  entry: VirtualSettingsEntry,
  values: Record<string, string | number | boolean>,
): SettingsEntry {
  const area = normalizeSettingsAreaLabel(entry.details.area)
  const anchorId =
    area === API_NATIVE_BROWSER_MCP_DOC_AREA
      ? getApiNativeBrowserMcpApiRowAnchorId(entry.meta.key)
      : area === CRAWLER_ACCESS_MCP_DOC_AREA
        ? getCrawlerAccessMcpApiRowAnchorId(entry.meta.key)
      : area === STRIPE_MCP_DOC_AREA
        ? getStripeMcpApiRowAnchorId(entry.meta.key)
      : area === PIXVERSE_MCP_DOC_AREA
        ? getPixVerseMcpApiRowAnchorId(entry.meta.key)
        : getGrabMapsMcpApiRowAnchorId(entry.meta.key)
  const mappedEntry = buildDocMappedEntry(entry, values, anchorId)
  const configJson =
    entry.meta.key === API_NATIVE_BROWSER_MCP_AGENT_CONFIG_KEY
      ? buildApiNativeBrowserMcpAgentConfigJson(values)
      : entry.meta.key === API_NATIVE_BROWSER_MCP_BRIDGE_CONFIG_KEY
        ? buildBrowserBridgeMcpConfigJson(values)
        : entry.meta.key === STRIPE_MCP_REMOTE_CONFIG_KEY
          ? buildStripeRemoteMcpConfigJson(values)
          : entry.meta.key === STRIPE_MCP_LOCAL_CONFIG_KEY
            ? buildStripeLocalMcpConfigJson(values)
          : entry.meta.key === PIXVERSE_MCP_LOCAL_CONFIG_KEY
            ? buildPixVerseLocalMcpConfigJson(values)
            : ''
  if (!configJson) return mappedEntry
  return {
    ...mappedEntry,
    index: normalizeText([mappedEntry.index, configJson].join(' ')),
    valueDisplayOverride: configJson,
  }
}
