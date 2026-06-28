import { testOfficialEndpointsNormalizeToProxyPaths } from '@/__tests__/chatEndpointProviders.test'
import { testAgnesProviderOptionsReuseSharedChatCompletionsShape } from '@/__tests__/floatingPanelChatProviderOptions.test'
import {
  testIntegrationsHubReusesSettingsEntryList,
  testIntegrationsHubSectionLinksOpenFloatingPanels,
} from '@/__tests__/mainPanelIntegrations.test'

async function main() {
  testOfficialEndpointsNormalizeToProxyPaths()
  testAgnesProviderOptionsReuseSharedChatCompletionsShape()
  await testIntegrationsHubReusesSettingsEntryList()
  await testIntegrationsHubSectionLinksOpenFloatingPanels()
  console.log('OK subsetAgnesSmoke')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
