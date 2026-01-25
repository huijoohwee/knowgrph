import { useCallback, useState } from 'react'

type WorkspaceActionsMenuKey =
  | 'sourceFilesImport'
  | 'sourceFilesExport'
  | 'parserExport'
  | 'markdownImport'
  | 'htmlImport'
  | 'pdfImport'
  | 'youTubeImport'
  | 'jsonImport'
  | 'jsonLdImport'
  | 'schemaExport'
  | 'graphFieldsExport'
  | 'settingsExport'
  | 'historyExport'
  | 'validationExport'

export function useWorkspaceActionsMenuState() {
  const [isSourceFilesImportMenuOpen, setIsSourceFilesImportMenuOpen] = useState(false)
  const [isSourceFilesExportMenuOpen, setIsSourceFilesExportMenuOpen] = useState(false)
  const [isParserExportMenuOpen, setIsParserExportMenuOpen] = useState(false)
  const [isMarkdownImportMenuOpen, setIsMarkdownImportMenuOpen] = useState(false)
  const [isHtmlImportMenuOpen, setIsHtmlImportMenuOpen] = useState(false)
  const [isPdfImportMenuOpen, setIsPdfImportMenuOpen] = useState(false)
  const [isYouTubeImportMenuOpen, setIsYouTubeImportMenuOpen] = useState(false)
  const [isJsonImportMenuOpen, setIsJsonImportMenuOpen] = useState(false)
  const [isJsonLdImportMenuOpen, setIsJsonLdImportMenuOpen] = useState(false)
  const [isSchemaExportMenuOpen, setIsSchemaExportMenuOpen] = useState(false)
  const [isGraphFieldsExportMenuOpen, setIsGraphFieldsExportMenuOpen] = useState(false)
  const [isSettingsExportMenuOpen, setIsSettingsExportMenuOpen] = useState(false)
  const [isHistoryExportMenuOpen, setIsHistoryExportMenuOpen] = useState(false)
  const [isValidationExportMenuOpen, setIsValidationExportMenuOpen] = useState(false)

  const closeAllMenusExcept = useCallback((except: WorkspaceActionsMenuKey | null) => {
    if (except !== 'sourceFilesImport') setIsSourceFilesImportMenuOpen(false)
    if (except !== 'sourceFilesExport') setIsSourceFilesExportMenuOpen(false)
    if (except !== 'parserExport') setIsParserExportMenuOpen(false)
    if (except !== 'markdownImport') setIsMarkdownImportMenuOpen(false)
    if (except !== 'htmlImport') setIsHtmlImportMenuOpen(false)
    if (except !== 'pdfImport') setIsPdfImportMenuOpen(false)
    if (except !== 'youTubeImport') setIsYouTubeImportMenuOpen(false)
    if (except !== 'jsonImport') setIsJsonImportMenuOpen(false)
    if (except !== 'jsonLdImport') setIsJsonLdImportMenuOpen(false)
    if (except !== 'schemaExport') setIsSchemaExportMenuOpen(false)
    if (except !== 'graphFieldsExport') setIsGraphFieldsExportMenuOpen(false)
    if (except !== 'settingsExport') setIsSettingsExportMenuOpen(false)
    if (except !== 'historyExport') setIsHistoryExportMenuOpen(false)
    if (except !== 'validationExport') setIsValidationExportMenuOpen(false)
  }, [])

  const closeAllMenus = useCallback(() => {
    closeAllMenusExcept(null)
  }, [closeAllMenusExcept])

  return {
    isSourceFilesImportMenuOpen,
    setIsSourceFilesImportMenuOpen,
    isSourceFilesExportMenuOpen,
    setIsSourceFilesExportMenuOpen,
    isParserExportMenuOpen,
    setIsParserExportMenuOpen,
    isMarkdownImportMenuOpen,
    setIsMarkdownImportMenuOpen,
    isHtmlImportMenuOpen,
    setIsHtmlImportMenuOpen,
    isPdfImportMenuOpen,
    setIsPdfImportMenuOpen,
    isYouTubeImportMenuOpen,
    setIsYouTubeImportMenuOpen,
    isJsonImportMenuOpen,
    setIsJsonImportMenuOpen,
    isJsonLdImportMenuOpen,
    setIsJsonLdImportMenuOpen,
    isSchemaExportMenuOpen,
    setIsSchemaExportMenuOpen,
    isGraphFieldsExportMenuOpen,
    setIsGraphFieldsExportMenuOpen,
    isSettingsExportMenuOpen,
    setIsSettingsExportMenuOpen,
    isHistoryExportMenuOpen,
    setIsHistoryExportMenuOpen,
    isValidationExportMenuOpen,
    setIsValidationExportMenuOpen,
    closeAllMenus,
    closeAllMenusExcept,
  }
}
