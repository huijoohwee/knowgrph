import type { TestCaseTuple } from '../runner/testRunnerTypes'

export const TEST_CASES_POST_PARSER_7: TestCaseTuple[] = [
  ["aiShowrunner.briefScript.roundTrip","@/__tests__/aiShowrunner.test","testAiShowrunnerBriefAndScriptRoundTrip"],
  ["aiShowrunner.stateBusToken.contracts","@/__tests__/aiShowrunner.test","testAiShowrunnerStateBusAndTokenContracts"],
  ["aiShowrunner.dryRun.artifactStructure","@/__tests__/aiShowrunner.test","testAiShowrunnerDryRunProducesArtifactStructure"],
  ["aiShowrunner.podcast.voiceMapCoverage","@/__tests__/aiShowrunner.test","testAiShowrunnerPodcastVoiceMapCoverage"],
  ["aiShowrunner.flowRegistry.integration","@/__tests__/aiShowrunner.test","testAiShowrunnerFlowAndRegistryIntegration"],
  ["aiShowrunner.hygiene.noProviderHardcodes","@/__tests__/aiShowrunner.test","testAiShowrunnerSourceContractsAvoidProviderHardcodes"],
  ["visualAnnotation.spec.model","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationSpecValidationAndModelResolution"],
  ["visualAnnotation.semantic.serializers","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationSemanticKeyAndSerializers"],
  ["visualAnnotation.run.artifactOnce","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationRunDelegatesArtifactOnce"],
  ["visualAnnotation.run.inferenceError","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationRunReturnsStructuredInferenceError"],
  ["visualAnnotation.worker.heuristicOutput","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationWorkerHeuristicProducesRuntimeOutput"],
  ["visualAnnotation.frontmatter.cells","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationSpecReadsFrontmatterCells"],
  ["visualAnnotation.registry.mcp","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationRegistriesAndMcpContract"],
  ["visualAnnotation.ssot.noMlImports","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationSsotAvoidsMlImports"],
  ["visualAnnotation.runAll.sequence","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationRunAllSequenceIncludesAnnotationNodes"],
  ["visualAnnotation.runAll.typedFrontmatterRouting","@/__tests__/visualAnnotationEngine.test","testVisualAnnotationRunAllRoutesTypedFrontmatterNodes"],
]
