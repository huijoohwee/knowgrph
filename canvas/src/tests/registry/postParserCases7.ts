import type { TestCaseTuple } from '../runner/testRunnerTypes'

export const TEST_CASES_POST_PARSER_7: TestCaseTuple[] = [
  ["aiShowrunner.briefScript.roundTrip","@/__tests__/aiShowrunner.test","testAiShowrunnerBriefAndScriptRoundTrip"],
  ["aiShowrunner.stateBusToken.contracts","@/__tests__/aiShowrunner.test","testAiShowrunnerStateBusAndTokenContracts"],
  ["aiShowrunner.dryRun.artifactStructure","@/__tests__/aiShowrunner.test","testAiShowrunnerDryRunProducesArtifactStructure"],
  ["aiShowrunner.podcast.voiceMapCoverage","@/__tests__/aiShowrunner.test","testAiShowrunnerPodcastVoiceMapCoverage"],
  ["aiShowrunner.flowRegistry.integration","@/__tests__/aiShowrunner.test","testAiShowrunnerFlowAndRegistryIntegration"],
  ["aiShowrunner.hygiene.noProviderHardcodes","@/__tests__/aiShowrunner.test","testAiShowrunnerSourceContractsAvoidProviderHardcodes"],
]
