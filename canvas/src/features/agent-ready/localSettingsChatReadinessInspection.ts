import type { LocalSettingsChatReadinessSurfaceSnapshot } from './browserLocalSurfaceSnapshots'

const normalizeString = (value: unknown): string => String(value || '').trim()

export const inspectLocalSettingsChatReadiness = (
  snapshot: (LocalSettingsChatReadinessSurfaceSnapshot & { updatedAtMs?: number }) | null,
) => {
  if (!snapshot) {
    return {
      available: false,
      sourceKind: 'browser-local-settings-chat-readiness',
      message: 'SettingsView chat readiness is not currently mounted in the local Knowgrph browser runtime.',
    }
  }
  return {
    available: true,
    sourceKind: 'browser-local-settings-chat-readiness',
    provider: {
      id: snapshot.normalizedChatProvider,
      endpointUrl: snapshot.chatEndpointUrl,
      model: snapshot.chatModel,
      authMode: snapshot.chatAuthMode,
    },
    routing: {
      contextScope: snapshot.chatContextScope,
      integrationEnabled: snapshot.integrationEnabled,
      integrationOpenTab: snapshot.integrationOpenTab,
    },
    modelDiscovery: {
      refreshing: snapshot.isRefreshingChatModels,
      status: snapshot.chatModelsStatus,
      discoveredCount: snapshot.discoveredChatModelCount,
      suggestionCount: snapshot.suggestedChatModelCount,
      ready: normalizeString(snapshot.chatModel).length > 0 && normalizeString(snapshot.chatEndpointUrl).length > 0,
    },
    updatedAtMs: snapshot.updatedAtMs || null,
  }
}
