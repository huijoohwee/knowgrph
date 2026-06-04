import React from 'react'
import type { SettingsRowActions, SettingsRowRefs, SettingsRowStatusState, SettingsRowUi } from './settingsRowTypes'

type UseSettingsRowBundlesArgs = {
  applyActiveWorkspaceFileAsChatHistory: () => void
  applyActiveWorkspaceFileAsKnowgrph: () => void
  buildChatAssistNodes: (rowKey: string) => React.ReactNode[]
  bytePlusHealthDetails: string | null
  bytePlusHealthOk: boolean | null
  chatHealthDetails: string | null
  chatHealthOk: boolean | null
  chatHistoryPathStatus: string | null
  checkBytePlusHealth: () => void
  checkBytePlusVideoModelPreview: () => void
  checkChatHealth: () => void
  checkDeerFlowHealth: () => void
  checkGrabMapsHealth: () => Promise<unknown>
  createAndSelectChatHistoryFile: () => Promise<unknown>
  createAndSelectKnowgrphFile: () => Promise<unknown>
  dirtyRef: React.MutableRefObject<Set<string>>
  deerFlowHealthDetails: string | null
  deerFlowHealthOk: boolean | null
  grabMapsHealthDetails: string | null
  grabMapsHealthOk: boolean | null
  importCloudUrlForChatHistory: () => void
  importCloudUrlForKnowgrph: () => void
  isCheckingBytePlusHealth: boolean
  isCheckingBytePlusVideoModelPreview: boolean
  isCheckingDeerFlowHealth: boolean
  isCheckingGrabMapsHealth: boolean
  isCheckingHealth: boolean
  isUpdatingChatHistoryPath: boolean
  isUpdatingKnowgrphPath: boolean
  kgcLocalImportInputRef: React.RefObject<HTMLInputElement | null>
  kgcLocalFolderImportInputRef: React.RefObject<HTMLInputElement | null>
  knowgrphPathStatus: string | null
  localImportInputRef: React.RefObject<HTMLInputElement | null>
  localFolderImportInputRef: React.RefObject<HTMLInputElement | null>
  normalizedChatProvider: string
  openFilePicker: (el: HTMLInputElement | null) => void
  openWorkspaceFile: (path: string) => void
  pushUiToast: SettingsRowActions['pushUiToast']
  renderInput: SettingsRowActions['renderInput']
  setChatHistoryPathStatus: React.Dispatch<React.SetStateAction<string | null>>
  setKnowgrphPathStatus: React.Dispatch<React.SetStateAction<string | null>>
  setValues: React.Dispatch<React.SetStateAction<Record<string, string | number | boolean>>>
  settingsTypeIconSizeClass: string
  uiIconStrokeWidth: number
  uiPanelKeyValueTextSizeClass: string
}

export function useSettingsRowBundles({
  applyActiveWorkspaceFileAsChatHistory,
  applyActiveWorkspaceFileAsKnowgrph,
  buildChatAssistNodes,
  bytePlusHealthDetails,
  bytePlusHealthOk,
  chatHealthDetails,
  chatHealthOk,
  chatHistoryPathStatus,
  checkBytePlusHealth,
  checkBytePlusVideoModelPreview,
  checkChatHealth,
  checkDeerFlowHealth,
  checkGrabMapsHealth,
  createAndSelectChatHistoryFile,
  createAndSelectKnowgrphFile,
  dirtyRef,
  deerFlowHealthDetails,
  deerFlowHealthOk,
  grabMapsHealthDetails,
  grabMapsHealthOk,
  importCloudUrlForChatHistory,
  importCloudUrlForKnowgrph,
  isCheckingBytePlusHealth,
  isCheckingBytePlusVideoModelPreview,
  isCheckingDeerFlowHealth,
  isCheckingGrabMapsHealth,
  isCheckingHealth,
  isUpdatingChatHistoryPath,
  isUpdatingKnowgrphPath,
  kgcLocalImportInputRef,
  kgcLocalFolderImportInputRef,
  knowgrphPathStatus,
  localImportInputRef,
  localFolderImportInputRef,
  normalizedChatProvider,
  openFilePicker,
  openWorkspaceFile,
  pushUiToast,
  renderInput,
  setChatHistoryPathStatus,
  setKnowgrphPathStatus,
  setValues,
  settingsTypeIconSizeClass,
  uiIconStrokeWidth,
  uiPanelKeyValueTextSizeClass,
}: UseSettingsRowBundlesArgs) {
  const refs = React.useMemo<SettingsRowRefs>(() => ({
    dirtyRef,
    kgcLocalImportInputRef,
    kgcLocalFolderImportInputRef,
    localImportInputRef,
    localFolderImportInputRef,
  }), [dirtyRef, kgcLocalFolderImportInputRef, kgcLocalImportInputRef, localFolderImportInputRef, localImportInputRef])

  const status = React.useMemo<SettingsRowStatusState>(() => ({
    bytePlusHealthDetails,
    bytePlusHealthOk,
    chatHealthDetails,
    chatHealthOk,
    chatHistoryPathStatus,
    deerFlowHealthDetails,
    deerFlowHealthOk,
    grabMapsHealthDetails,
    grabMapsHealthOk,
    isCheckingBytePlusHealth,
    isCheckingBytePlusVideoModelPreview,
    isCheckingDeerFlowHealth,
    isCheckingGrabMapsHealth,
    isCheckingHealth,
    isUpdatingChatHistoryPath,
    isUpdatingKnowgrphPath,
    knowgrphPathStatus,
    normalizedChatProvider,
  }), [
    bytePlusHealthDetails,
    bytePlusHealthOk,
    chatHealthDetails,
    chatHealthOk,
    chatHistoryPathStatus,
    deerFlowHealthDetails,
    deerFlowHealthOk,
    grabMapsHealthDetails,
    grabMapsHealthOk,
    isCheckingBytePlusHealth,
    isCheckingBytePlusVideoModelPreview,
    isCheckingDeerFlowHealth,
    isCheckingGrabMapsHealth,
    isCheckingHealth,
    isUpdatingChatHistoryPath,
    isUpdatingKnowgrphPath,
    knowgrphPathStatus,
    normalizedChatProvider,
  ])

  const ui = React.useMemo<SettingsRowUi>(() => ({
    settingsTypeIconSizeClass,
    uiIconStrokeWidth,
    uiPanelKeyValueTextSizeClass,
  }), [settingsTypeIconSizeClass, uiIconStrokeWidth, uiPanelKeyValueTextSizeClass])

  const actions = React.useMemo<SettingsRowActions>(() => ({
    applyActiveWorkspaceFileAsChatHistory,
    applyActiveWorkspaceFileAsKnowgrph,
    buildChatAssistNodes,
    checkBytePlusHealth,
    checkBytePlusVideoModelPreview,
    checkChatHealth,
    checkDeerFlowHealth,
    checkGrabMapsHealth,
    createAndSelectChatHistoryFile,
    createAndSelectKnowgrphFile,
    importCloudUrlForChatHistory,
    importCloudUrlForKnowgrph,
    openFilePicker,
    openWorkspaceFile,
    pushUiToast,
    renderInput,
    setChatHistoryPathStatus,
    setKnowgrphPathStatus,
    setValues,
  }), [
    applyActiveWorkspaceFileAsChatHistory,
    applyActiveWorkspaceFileAsKnowgrph,
    buildChatAssistNodes,
    checkBytePlusHealth,
    checkBytePlusVideoModelPreview,
    checkChatHealth,
    checkDeerFlowHealth,
    checkGrabMapsHealth,
    createAndSelectChatHistoryFile,
    createAndSelectKnowgrphFile,
    importCloudUrlForChatHistory,
    importCloudUrlForKnowgrph,
    openFilePicker,
    openWorkspaceFile,
    pushUiToast,
    renderInput,
    setChatHistoryPathStatus,
    setKnowgrphPathStatus,
    setValues,
  ])

  return { actions, refs, status, ui }
}
