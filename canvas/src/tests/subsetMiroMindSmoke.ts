import {
  testMiroMindServerManagedProxyEnvNamesStayAligned,
  testOfficialEndpointsNormalizeToProxyPaths,
} from '@/__tests__/chatEndpointProviders.test'
import { testMiroMindProviderOptionsReuseSharedChatCompletionsShape } from '@/__tests__/floatingPanelChatProviderOptions.test'
import { testMainPanelMiroMindApiKeyUsesServerManagedPagesSecretContract } from '@/__tests__/mainPanelMiroMindPagesReadiness.test'
import { testMainPanelRequestedIntegrationsSearchShowsMiroMindApiConfigurableValues } from '@/__tests__/mainPanelIntegrations.test'

async function main() {
  testOfficialEndpointsNormalizeToProxyPaths()
  testMiroMindServerManagedProxyEnvNamesStayAligned()
  testMiroMindProviderOptionsReuseSharedChatCompletionsShape()
  await testMainPanelRequestedIntegrationsSearchShowsMiroMindApiConfigurableValues()
  await testMainPanelMiroMindApiKeyUsesServerManagedPagesSecretContract()
  console.log('OK subsetMiroMindSmoke')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
