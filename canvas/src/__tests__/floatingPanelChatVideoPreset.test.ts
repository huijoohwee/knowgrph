import fs from 'node:fs'
import path from 'node:path'
import { createMemoryWorkspaceFs } from '@/features/workspace-fs/workspaceFsMemory'
import { TEST_VALIDATION_WORKSPACE_SEED_PATH } from '@/features/workspace-fs/workspaceFs'
import { isVideoAgentDemoPresetError, loadVideoAgentDemoPreset } from '@/features/chat/videoAgentDemoPreset'
import { isVideoAgentDemoPresetInvocation } from '@/features/chat/floatingPanelChat/videoAgentDemoPresetSubmit'

const sourcePath = '/docs/video-script.md'
const invocation = '/video-agent @video-generation-demo-script @provider.byteplus @text @image @audio @video #spec.low [video-script.md](workspace:/docs/video-script.md)'

const presetMarkdown = [
  '---',
  'inputs:',
  `  video_generation_demo_script: "workspace:${sourcePath}"`,
  `  default_invocation: "${invocation}"`,
  '---',
  '',
  '# Video preset',
  '',
  '```text',
  invocation,
  '',
  'Generate the complete source-backed video package.',
  '```',
].join('\n')

const createPresetWorkspace = async () => {
  const workspace = createMemoryWorkspaceFs()
  await workspace.ensureSeed()
  await workspace.writeFileText(TEST_VALIDATION_WORKSPACE_SEED_PATH, presetMarkdown)
  await workspace.createFolder({ parentPath: '/', name: 'docs' })
  await workspace.createFile({ parentPath: '/docs', name: 'video-script.md', text: '# Source script' })
  return workspace
}

export async function testFloatingPanelChatVideoPresetLoadsSourceBackedInvocation() {
  const workspace = await createPresetWorkspace()
  const result = await loadVideoAgentDemoPreset(workspace)
  if (isVideoAgentDemoPresetError(result)) throw new Error(result.error)
  if (!result.prompt.startsWith(invocation) || !result.prompt.includes('Generate the complete source-backed video package.')) {
    throw new Error(`expected authored executable prompt, got ${result.prompt}`)
  }
  if (result.presetPath !== TEST_VALIDATION_WORKSPACE_SEED_PATH || result.sourcePath !== sourcePath) {
    throw new Error(`expected canonical preset/source paths, got ${JSON.stringify(result)}`)
  }
}

export async function testFloatingPanelChatVideoPresetFailsClosedWithoutSource() {
  const workspace = await createPresetWorkspace()
  await workspace.deleteEntry(sourcePath)
  const result = await loadVideoAgentDemoPreset(workspace)
  if (!isVideoAgentDemoPresetError(result) || !result.error.includes(sourcePath)) {
    throw new Error(`expected missing-source error, got ${JSON.stringify(result)}`)
  }
}

export function testFloatingPanelChatVideoPresetRendersAfterNewChat() {
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'features', 'chat', 'FloatingPanelChatSections.tsx'), 'utf8')
  const newChatIndex = source.indexOf('UI_COPY.chatNewChatButtonLabel')
  const presetIndex = source.indexOf('<FloatingPanelChatVideoPresetButton')
  if (newChatIndex < 0 || presetIndex <= newChatIndex) {
    throw new Error('expected the video preset control immediately after New Chat')
  }
}

export function testFloatingPanelChatVideoPresetInvocationBypassesGenericChat() {
  if (!isVideoAgentDemoPresetInvocation(invocation)) throw new Error('expected canonical video preset invocation')
  if (isVideoAgentDemoPresetInvocation('/video-agent @video #spec.low unrelated request')) {
    throw new Error('expected unrelated /video-agent requests to retain the generic chat path')
  }
  const submitHook = fs.readFileSync(path.join(process.cwd(), 'src', 'features', 'chat', 'floatingPanelChat', 'useFloatingPanelChatSubmit.ts'), 'utf8')
  const presetIndex = submitHook.indexOf('tryActivateVideoAgentDemoPreset')
  const requestIndex = submitHook.indexOf('resolveRequestUrlOrSetError({')
  if (presetIndex < 0 || requestIndex < 0 || presetIndex >= requestIndex) {
    throw new Error('expected source-backed preset activation before generic chat request preflight')
  }
}
