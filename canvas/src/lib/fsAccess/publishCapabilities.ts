import { isDirectoryPickerWriteSupported } from '@/lib/fsAccess/writeTextFileToDirectory'

export type PublishCapabilities = {
  isSecureContext: boolean
  isTopLevel: boolean
  canPickPublishFolder: boolean
  canPickPublishFile: boolean
}

export const getPublishCapabilities = (): PublishCapabilities => {
  const isSecure = typeof window !== 'undefined' && !!window.isSecureContext
  const isTopLevel = typeof window !== 'undefined' && window.top === window.self
  const canPickPublishFolder = isSecure && isDirectoryPickerWriteSupported()
  const canPickPublishFile = isSecure && typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  return {
    isSecureContext: isSecure,
    isTopLevel,
    canPickPublishFolder,
    canPickPublishFile,
  }
}

