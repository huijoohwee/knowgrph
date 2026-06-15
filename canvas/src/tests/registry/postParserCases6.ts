import type { TestCaseTuple } from '../runner/testRunnerTypes'

export const TEST_CASES_POST_PARSER_6: TestCaseTuple[] = [
  ["chat.responseContract.prompt.kgcComputingFlowKtvShape","@/__tests__/chatResponseKgcComputingFlowContract.test","testChatKgcResponseContractPromptEnforcesComputingFlowShape"],
  ["chat.responseContract.storage.kgcComputingFlowKtvBodyTokens","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcDeterministicFallbackGeneratesComputingFlowKtvBodyTokens"],
  ["chat.responseContract.storage.kgcPreservesAssistantAnswerResponseBody","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcDeterministicFallbackPreservesAssistantAnswerInResponseBody"],
  ["chat.responseContract.storage.kgcSubstantiveAnswerComputingFlowBodyOnly","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcSubstantiveAssistantAnswerUsesComputingFlowBodyOnly"],
  ["chat.responseContract.storage.kgcSubstantiveAnswerSeedsRichMediaOutputs","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcSubstantiveAssistantAnswerSeedsRichMediaOutputs"],
  ["chat.responseContract.storage.kgcTraceOnlyNoBackfillBody","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcDeterministicFallbackTraceOnlyKeepsHumanFacingNoBackfill"],
  ["chat.responseContract.storage.kgcComputingFlowStripsAppendedCanonicalSections","@/__tests__/chatResponseKgcComputingFlowContract.test","testKgcComputingFlowStripsAppendedCanonicalSections"],
  ["richMedia.panel.markdownScrollSurfaceCanPanCanvas","@/__tests__/richMediaPanelMarkdownScrollSurfacePan.test","testRichMediaPanelMarkdownScrollSurfaceCanPanCanvasWhenForwarded"],
  ["ui.floatingPanelChat.apiKeyPrompt.byokOnly","@/__tests__/floatingPanelChatFooterSelect.test","testFloatingPanelChatApiKeyPromptIsByokOnly"],
  ["ui.floatingPanelChat.apiKey.modelIconAlignment","@/__tests__/floatingPanelChatFooterSelect.test","testFloatingPanelChatFooterByokApiKeyToggleStaysAtModelIconAndAlignsInput"],
  ["ui.floatingPanelChat.relayStatus.visibleSeparateFromConnectivity","@/__tests__/floatingPanelChatFooterSelect.test","testFloatingPanelChatFooterShowsRelayStatusSeparatelyFromEndpointConnectivity"],
  ["ui.floatingPanelChat.relaySummary.workspacePolicyContext","@/__tests__/floatingPanelChatFooterSelect.test","testFloatingPanelChatFooterShowsRelayWorkspacePolicySummary"],
  ["ui.floatingPanelChat.relaySummary.openLogAction","@/__tests__/floatingPanelChatFooterSelect.test","testFloatingPanelChatFooterRelaySummaryActionOpensLogCallback"],
  ["ui.floatingPanelChat.relayDiagnostics.disabledAndLoadingSkipSharedLogRows","@/__tests__/floatingPanelChatRelayDiagnostics.test","testBuildStorageChatRelayLogDescriptorReturnsNullForDisabledAndLoadingStates"],
  ["ui.floatingPanelChat.relayDiagnostics.readyAndBlockedUseSharedLogRows","@/__tests__/floatingPanelChatRelayDiagnostics.test","testBuildStorageChatRelayLogDescriptorBuildsReadyAndBlockedEntries"],
]
