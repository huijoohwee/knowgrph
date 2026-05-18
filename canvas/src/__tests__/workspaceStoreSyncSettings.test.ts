import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import { uiWorkspaceSettingsRegistry } from '@/features/settings/registry-ui.workspace'
import { readWorkspaceImportDefaultSourceUrlSetting } from '@/lib/workspace/workspaceStoreSyncSettings'

const DASH_D1_URL = 'https://dash.cloudflare.com/170e89fdb8679ff2fcc2900e25ed04f4/workers/d1'
const LOCAL_DOCS_ROOT_SAMPLE = ['', 'Users', 'huijoohwee', 'Documents', 'GitHub', 'huijoohwee', 'docs'].join('/')

export function testWorkspaceImportDefaultSourceUrlPrefersStorageBaseUrlForLocalPathAndDashboardUrl() {
  const { restore } = initJsdomHarness()
  const previousBaseUrl = process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
  const previousValue = readWorkspaceImportDefaultSourceUrlSetting()
  const store = useGraphStore.getState()
  const previousSyncMode = store.canvasWorkspaceSyncMode
  process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = 'https://airvio.co'
  const setting = uiWorkspaceSettingsRegistry.find(item => item.key === 'workspace.import.defaultSourceUrl')
  if (!setting || typeof setting.write !== 'function') {
    restore()
    throw new Error('expected workspace.import.defaultSourceUrl setting to be writable')
  }
  try {
    store.setCanvasWorkspaceSyncMode('manual')
    setting.write(LOCAL_DOCS_ROOT_SAMPLE)
    const afterLocalPath = readWorkspaceImportDefaultSourceUrlSetting()
    if (afterLocalPath !== 'https://airvio.co') {
      throw new Error(`expected local-path import default source URL to normalize to storage base URL, got ${afterLocalPath}`)
    }
    if (useGraphStore.getState().canvasWorkspaceSyncMode !== 'realtime') {
      throw new Error('expected workspace import default source URL write to switch canvasWorkspaceSyncMode to realtime')
    }
    setting.write(DASH_D1_URL)
    const afterDashboardUrl = readWorkspaceImportDefaultSourceUrlSetting()
    if (afterDashboardUrl !== 'https://airvio.co') {
      throw new Error(`expected Cloudflare D1 dashboard URL to normalize to storage base URL, got ${afterDashboardUrl}`)
    }
  } finally {
    setting.write(previousValue)
    useGraphStore.getState().setCanvasWorkspaceSyncMode(previousSyncMode)
    if (typeof previousBaseUrl === 'string') process.env.VITE_KNOWGRPH_STORAGE_BASE_URL = previousBaseUrl
    else delete process.env.VITE_KNOWGRPH_STORAGE_BASE_URL
    restore()
  }
}
