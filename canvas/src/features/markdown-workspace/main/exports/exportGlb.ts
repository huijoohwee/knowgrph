import type { UiToastInput } from '@/hooks/store/types'
import { downloadBlob, saveBlobWithPicker } from '@/lib/graph/save'
import { writeKgcCompanionOutputBlob } from '@/features/chat/chatHistoryWorkspace.output'

const GLB_MIME_TYPE = 'model/gltf-binary'
const GLTF_MIME_TYPE = 'model/gltf+json'

export async function exportCanvasGltf(args: {
  exportBaseName: string
  activeDocumentPath?: string | null
  pushUiToast: (toast: UiToastInput) => void
  getStore: () => {
    captureThreeGltfSnapshot: () => Promise<Blob | null>
  }
}): Promise<void> {
  try {
    const baseName = String(args.exportBaseName || '').trim() || 'document'
    const suggested = `${baseName}.gltf`
    const rawGltf = await args.getStore().captureThreeGltfSnapshot()
    if (!rawGltf) {
      args.pushUiToast({
        id: 'export-gltf-missing-canvas',
        kind: 'warning',
        message: 'No 3D GLTF snapshot available. Switch Canvas to a 3D surface and retry.',
      })
      return
    }

    const gltfBlob = String(rawGltf.type || '').trim() === GLTF_MIME_TYPE
      ? rawGltf
      : new Blob([await rawGltf.text()], { type: GLTF_MIME_TYPE })
    const saved = await saveBlobWithPicker(gltfBlob, suggested, {
      description: 'GLTF Files',
      accept: {
        [GLTF_MIME_TYPE]: ['.gltf'],
        'application/json': ['.gltf'],
      },
    })
    if (saved === '') return
    if (!saved) downloadBlob(gltfBlob, suggested)
    await writeKgcCompanionOutputBlob({
      workspacePath: args.activeDocumentPath,
      extension: 'gltf',
      blob: gltfBlob,
    })
    args.pushUiToast({
      id: 'export-gltf-ok',
      kind: 'success',
      message: 'Exported GLTF',
      ttlMs: 1800,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'export-gltf-failed',
      kind: 'error',
      message: `GLTF export failed: ${String((e as { message?: unknown })?.message ?? e)}`,
    })
  }
}

export async function exportCanvasGlb(args: {
  exportBaseName: string
  activeDocumentPath?: string | null
  pushUiToast: (toast: UiToastInput) => void
  getStore: () => {
    captureThreeGlbSnapshot: () => Promise<Blob | null>
  }
}): Promise<void> {
  try {
    const baseName = String(args.exportBaseName || '').trim() || 'document'
    const suggested = `${baseName}.glb`
    const rawGlb = await args.getStore().captureThreeGlbSnapshot()
    if (!rawGlb) {
      args.pushUiToast({
        id: 'export-glb-missing-canvas',
        kind: 'warning',
        message: 'No 3D GLB snapshot available. Switch Canvas to a 3D surface and retry.',
      })
      return
    }

    const glbBlob = String(rawGlb.type || '').trim() === GLB_MIME_TYPE
      ? rawGlb
      : new Blob([await rawGlb.arrayBuffer()], { type: GLB_MIME_TYPE })
    const saved = await saveBlobWithPicker(glbBlob, suggested, {
      description: 'GLB Files',
      accept: {
        [GLB_MIME_TYPE]: ['.glb'],
        'application/octet-stream': ['.glb'],
      },
    })
    if (saved === '') return
    if (!saved) downloadBlob(glbBlob, suggested)
    await writeKgcCompanionOutputBlob({
      workspacePath: args.activeDocumentPath,
      extension: 'glb',
      blob: glbBlob,
    })
    args.pushUiToast({
      id: 'export-glb-ok',
      kind: 'success',
      message: 'Exported GLB',
      ttlMs: 1800,
      dismissible: false,
    })
  } catch (e) {
    args.pushUiToast({
      id: 'export-glb-failed',
      kind: 'error',
      message: `GLB export failed: ${String((e as { message?: unknown })?.message ?? e)}`,
    })
  }
}
