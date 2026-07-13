import { applyWorkspaceImportToCanvas } from '@/features/workspace-fs/applyWorkspaceImportToCanvas'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { activateFirstImportedWorkspaceFile } from '@/features/markdown-workspace/useWorkspaceFileActions/importRuntimeActions'
import { AGENTIC_VIDEO_ROUTE_TOKEN, VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN } from '@/features/chat/generationInvocation'
import { isVideoAgentDemoPresetError, loadVideoAgentDemoPreset } from '@/features/chat/videoAgentDemoPreset'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import type { FloatingPanelChatSubmitArgs } from './floatingPanelChatSubmitTypes'

export const isVideoAgentDemoPresetInvocation = (input: string): boolean => {
  const invocationTokens = new Set(
    splitInvocationTokenSegments(input)
      .filter(segment => segment.kind === 'token')
      .map(segment => segment.value.toLowerCase()),
  )
  return (
    invocationTokens.has(AGENTIC_VIDEO_ROUTE_TOKEN)
    && invocationTokens.has(VIDEO_GENERATION_DEMO_SCRIPT_BINDING_TOKEN)
  )
}

export const tryActivateVideoAgentDemoPreset = async (args: {
  input: string
  submitArgs: FloatingPanelChatSubmitArgs
}): Promise<boolean> => {
  if (!isVideoAgentDemoPresetInvocation(args.input)) return false
  const { submitArgs } = args
  submitArgs.setErrorText(null)
  submitArgs.setIsLoading(true)
  try {
    const preset = await loadVideoAgentDemoPreset()
    if (isVideoAgentDemoPresetError(preset)) {
      submitArgs.setErrorText(preset.error)
      return true
    }
    const fs = await getWorkspaceFs()
    await applyWorkspaceImportToCanvas({
      fs,
      createdPaths: [preset.presetPath, preset.sourcePath],
      opts: { applyToGraph: true },
    })
    await activateFirstImportedWorkspaceFile({
      fs,
      createdPaths: [preset.presetPath],
      applyToGraph: true,
    })
    submitArgs.setInput('')
    submitArgs.setMessages(previous => [
      ...previous,
      { id: `video-preset-user-${Date.now().toString(36)}`, role: 'user', content: args.input },
      {
        id: `video-preset-assistant-${Date.now().toString(36)}`,
        role: 'assistant',
        content: 'Activated the source-backed agentic video canvas. Review the Text, Image, Video, audio-track, and Rich Media nodes, then use Run all to execute configured provider stages.',
      },
    ])
    return true
  } catch (error) {
    submitArgs.setErrorText(error instanceof Error ? error.message : 'Unable to activate the video preset.')
    return true
  } finally {
    submitArgs.setIsLoading(false)
  }
}
