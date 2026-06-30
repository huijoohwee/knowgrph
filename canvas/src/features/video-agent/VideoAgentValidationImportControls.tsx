import React from 'react'
import { getMarkdownWorkspaceActionBridge, type WorkspaceImportUrlOpts } from '@/features/markdown-explorer/workspaceActionBridge'
import { cn } from '@/lib/utils'
import {
  buildVideoAgentValidationUrlOptions,
  mergeVideoAgentValidationConfigs,
  readVideoAgentValidationConfig,
  readVideoAgentValidationConfigFromRuntimeInput,
  serializeVideoAgentValidationUrls,
  splitVideoAgentValidationUrls,
  writeVideoAgentValidationConfig,
  type VideoAgentValidationUrlOption,
} from './videoAgentValidationConfig'

export type VideoAgentValidationUrlActionMode = 'import' | 'select'

type ImportUrlFallback = (urlRaw: string, opts?: WorkspaceImportUrlOpts) => void | Promise<void>

export type VideoAgentValidationImportControlsProps = {
  actionClassName: string
  actionsAriaLabel: string
  containerAriaLabel: string
  containerClassName?: string
  docPathAriaLabel: string
  docPathLabel?: string
  docPathPlaceholder?: string
  fieldClassName: string
  flowEditorDataHook?: boolean
  importSetLabel?: string
  importUrlFallback?: ImportUrlFallback
  importUrlOpts?: WorkspaceImportUrlOpts | (() => WorkspaceImportUrlOpts | undefined)
  onBeforeImport?: () => void
  onSelectUrl?: (url: string) => void
  optionAriaLabel?: (option: VideoAgentValidationUrlOption) => string
  optionButtonLabel?: (option: VideoAgentValidationUrlOption) => string
  optionMode: VideoAgentValidationUrlActionMode
  runtimeInput?: unknown
  showFieldLabels?: boolean
  textAreaClassName?: string
  urlsAriaLabel: string
  urlsLabel?: string
  urlsPlaceholder?: string
}

const resolveImportUrlOpts = (
  value: VideoAgentValidationImportControlsProps['importUrlOpts'],
): WorkspaceImportUrlOpts | undefined => {
  if (typeof value === 'function') return value()
  return value
}

export function VideoAgentValidationImportControls({
  actionClassName,
  actionsAriaLabel,
  containerAriaLabel,
  containerClassName,
  docPathAriaLabel,
  docPathLabel = 'Validation document path',
  docPathPlaceholder = 'Validation document path',
  fieldClassName,
  flowEditorDataHook = false,
  importSetLabel = 'Import set',
  importUrlFallback,
  importUrlOpts,
  onBeforeImport,
  onSelectUrl,
  optionAriaLabel,
  optionButtonLabel,
  optionMode,
  runtimeInput,
  showFieldLabels = false,
  textAreaClassName,
  urlsAriaLabel,
  urlsLabel = 'Validation import URLs',
  urlsPlaceholder = 'Validation import URLs',
}: VideoAgentValidationImportControlsProps) {
  const runtimeConfig = React.useMemo(() => readVideoAgentValidationConfigFromRuntimeInput(runtimeInput), [runtimeInput])
  const initialConfig = React.useMemo(
    () => mergeVideoAgentValidationConfigs(readVideoAgentValidationConfig(), runtimeConfig),
    [runtimeConfig],
  )
  const [validationDocPathDraft, setValidationDocPathDraft] = React.useState(initialConfig.validationDocPath)
  const [validationUrlsDraft, setValidationUrlsDraft] = React.useState(serializeVideoAgentValidationUrls(initialConfig.importUrls))
  const validationImportUrls = React.useMemo(() => splitVideoAgentValidationUrls(validationUrlsDraft), [validationUrlsDraft])
  const validationUrlOptions = React.useMemo(() => buildVideoAgentValidationUrlOptions(validationImportUrls), [validationImportUrls])
  const initialImportUrlsDraft = React.useMemo(() => serializeVideoAgentValidationUrls(initialConfig.importUrls), [initialConfig.importUrls])
  const runtimeDocPathHydratedRef = React.useRef(false)
  const runtimeUrlsHydratedRef = React.useRef(false)

  React.useEffect(() => {
    if (!runtimeDocPathHydratedRef.current && !validationDocPathDraft && initialConfig.validationDocPath) {
      runtimeDocPathHydratedRef.current = true
      setValidationDocPathDraft(initialConfig.validationDocPath)
    }
    if (!runtimeUrlsHydratedRef.current && validationImportUrls.length === 0 && initialImportUrlsDraft) {
      runtimeUrlsHydratedRef.current = true
      setValidationUrlsDraft(initialImportUrlsDraft)
    }
  }, [initialConfig.validationDocPath, initialImportUrlsDraft, validationDocPathDraft, validationImportUrls.length])

  const updateValidationDocPath = React.useCallback((next: string) => {
    setValidationDocPathDraft(next)
    writeVideoAgentValidationConfig({ validationDocPath: next, importUrls: splitVideoAgentValidationUrls(validationUrlsDraft) })
  }, [validationUrlsDraft])

  const updateValidationUrls = React.useCallback((next: string) => {
    setValidationUrlsDraft(next)
    writeVideoAgentValidationConfig({ validationDocPath: validationDocPathDraft, importUrls: splitVideoAgentValidationUrls(next) })
  }, [validationDocPathDraft])

  const importValidationUrl = React.useCallback((urlRaw: string) => {
    const url = String(urlRaw || '').trim()
    if (!url) return
    const opts = resolveImportUrlOpts(importUrlOpts)
    const bridge = getMarkdownWorkspaceActionBridge()
    if (typeof bridge.importUrl === 'function') {
      bridge.importUrl(url, opts)
      return
    }
    if (importUrlFallback) void importUrlFallback(url, opts)
  }, [importUrlFallback, importUrlOpts])

  const activateValidationUrl = React.useCallback((option: VideoAgentValidationUrlOption) => {
    if (optionMode === 'select') {
      onSelectUrl?.(option.url)
      return
    }
    onBeforeImport?.()
    importValidationUrl(option.url)
  }, [importValidationUrl, onBeforeImport, onSelectUrl, optionMode])

  const importValidationUrls = React.useCallback(() => {
    if (validationImportUrls.length === 0) return
    onBeforeImport?.()
    for (const url of validationImportUrls) importValidationUrl(url)
  }, [importValidationUrl, onBeforeImport, validationImportUrls])

  return (
    <section
      className={containerClassName}
      aria-label={containerAriaLabel}
      data-kg-flow-editor-video-agent-validation-controls={flowEditorDataHook ? '1' : undefined}
    >
      <label className={cn(showFieldLabels && 'grid min-w-0 gap-1 text-[11px]')}>
        {showFieldLabels ? <span className="truncate">{docPathLabel}</span> : null}
        <input
          className={fieldClassName}
          aria-label={docPathAriaLabel}
          placeholder={docPathPlaceholder}
          value={validationDocPathDraft}
          onChange={event => updateValidationDocPath(event.target.value)}
        />
      </label>
      <label className={cn(showFieldLabels && 'grid min-w-0 gap-1 text-[11px]')}>
        {showFieldLabels ? <span className="truncate">{urlsLabel}</span> : null}
        <textarea
          className={textAreaClassName || fieldClassName}
          aria-label={urlsAriaLabel}
          placeholder={urlsPlaceholder}
          value={validationUrlsDraft}
          onChange={event => updateValidationUrls(event.target.value)}
        />
      </label>
      <section className="flex min-w-0 flex-wrap items-stretch gap-1" aria-label={actionsAriaLabel}>
        {validationUrlOptions.map(option => (
          <button
            key={`${option.index}:${option.url}`}
            type="button"
            className={actionClassName}
            title={option.url}
            aria-label={optionAriaLabel ? optionAriaLabel(option) : `Use validation ${option.label}`}
            data-kg-video-agent-validation-url-option={option.index + 1}
            onClick={() => activateValidationUrl(option)}
          >
            {optionButtonLabel ? optionButtonLabel(option) : `Use ${option.label}`}
          </button>
        ))}
        <button
          type="button"
          className={actionClassName}
          disabled={validationImportUrls.length === 0}
          onClick={importValidationUrls}
        >
          {importSetLabel}
        </button>
      </section>
    </section>
  )
}
