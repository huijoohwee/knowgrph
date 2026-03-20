import React from 'react'
import { FolderOpen, Globe, Link, Save, Upload } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { SOURCE_FILES_COPY, SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { WORKSPACE_IMPORT_IMAGE_URL_TEST, WORKSPACE_IMPORT_URL_TEST } from '@/lib/config'

const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')

export function MarkdownWorkspaceExplorerHeaderActions(props: {
  microLabelClass: string
  onSave?: () => void
  saveDisabled?: boolean
  onImportLocalFiles?: (files: FileList | null) => void
  onImportLocalFolder?: (files: FileList | null) => void
  onImportUrl?: (url: string) => void
  onImportWebsite?: (url: string) => void
}) {
  const { microLabelClass, onSave, saveDisabled } = props

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const folderInputRef = React.useRef<HTMLInputElement | null>(null)
  const urlInputRef = React.useRef<HTMLInputElement | null>(null)
  const [urlDraft, setUrlDraft] = React.useState('')
  const [urlInputOpen, setUrlInputOpen] = React.useState(false)

  React.useEffect(() => {
    if (!urlInputOpen) return
    const id = requestAnimationFrame(() => {
      try {
        urlInputRef.current?.focus()
      } catch {
        void 0
      }
    })
    return () => cancelAnimationFrame(id)
  }, [urlInputOpen])

  const openFilePicker = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return
    try {
      const anyEl = el as unknown as { showPicker?: () => void }
      if (typeof anyEl.showPicker === 'function') {
        anyEl.showPicker()
        return
      }
    } catch {
      void 0
    }
    try {
      el.click()
    } catch {
      void 0
    }
  }, [])

  const baseBtnClass = `kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded cursor-pointer ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`

  const showImport =
    typeof props.onImportLocalFiles === 'function' ||
    typeof props.onImportLocalFolder === 'function' ||
    typeof props.onImportUrl === 'function' ||
    typeof props.onImportWebsite === 'function'

  return (
    <>
      {typeof props.onImportLocalFiles === 'function' ? (
        <input
          ref={el => {
            fileInputRef.current = el
          }}
          type="file"
          className="sr-only"
          accept={WORKSPACE_IMPORT_ACCEPT}
          multiple
          onChange={e => {
            props.onImportLocalFiles?.(e.target.files)
            try {
              e.currentTarget.value = ''
            } catch {
              void 0
            }
          }}
        />
      ) : null}

      {typeof props.onImportLocalFolder === 'function' ? (
        <input
          ref={el => {
            folderInputRef.current = el
            if (!el) return
            try {
              el.setAttribute('webkitdirectory', '')
              el.setAttribute('directory', '')
            } catch {
              void 0
            }
          }}
          type="file"
          className="sr-only"
          multiple
          onChange={e => {
            props.onImportLocalFolder?.(e.target.files)
            try {
              e.currentTarget.value = ''
            } catch {
              void 0
            }
          }}
        />
      ) : null}

      {typeof onSave === 'function' ? (
        <li className="list-none">
          <button
            type="button"
            className={baseBtnClass}
            title="Save"
            aria-label="Save"
            onClick={() => onSave()}
            disabled={saveDisabled === true}
          >
            <Save className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </li>
      ) : null}

      {showImport ? (
        <>
          {typeof props.onImportLocalFiles === 'function' ? (
            <li className="list-none">
              <button
                type="button"
                className={baseBtnClass}
                title="Import local files"
                aria-label="Import local files"
                onClick={() => openFilePicker(fileInputRef.current)}
              >
                <Upload className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
          ) : null}

          {typeof props.onImportLocalFolder === 'function' ? (
            <li className="list-none">
              <button
                type="button"
                className={baseBtnClass}
                title="Import folder"
                aria-label="Import folder"
                onClick={() => openFilePicker(folderInputRef.current)}
              >
                <FolderOpen className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </li>
          ) : null}

          {typeof props.onImportUrl === 'function' ? (
            <li className="list-none relative">
              <button
                type="button"
                className={baseBtnClass}
                title="Import URL"
                aria-label="Import URL"
                onClick={() => {
                  const draft = String(urlDraft || '').trim()
                  if (urlInputOpen) {
                    if (!draft) {
                      setUrlInputOpen(false)
                      return
                    }
                    props.onImportUrl?.(draft)
                    setUrlInputOpen(false)
                    return
                  }
                  if (!draft) {
                    if (WORKSPACE_IMPORT_URL_TEST) {
                      setUrlDraft(WORKSPACE_IMPORT_URL_TEST)
                    } else if (WORKSPACE_IMPORT_IMAGE_URL_TEST) {
                      setUrlDraft(WORKSPACE_IMPORT_IMAGE_URL_TEST)
                    }
                  }
                  setUrlInputOpen(true)
                }}
              >
                <Link className="w-4 h-4" strokeWidth={1.6} />
              </button>
              <section
                className={
                  urlInputOpen
                    ? 'absolute right-full top-0 mr-1 w-72 opacity-100'
                    : 'absolute right-full top-0 mr-1 w-0 opacity-0 pointer-events-none'
                }
                aria-label="Import URL input"
              >
                <section className="w-72" aria-label="URL import controls">
                  {WORKSPACE_IMPORT_URL_TEST || WORKSPACE_IMPORT_IMAGE_URL_TEST ? (
                    <section className="mb-1 flex items-center gap-1" aria-label="URL import test shortcuts">
                      {WORKSPACE_IMPORT_URL_TEST ? (
                        <button
                          type="button"
                          className={`h-6 px-2 inline-flex items-center justify-center rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${microLabelClass}`}
                          title="Use test-url"
                          onClick={() => {
                            setUrlDraft(WORKSPACE_IMPORT_URL_TEST)
                          }}
                        >
                          Test URL
                        </button>
                      ) : null}
                      {WORKSPACE_IMPORT_IMAGE_URL_TEST ? (
                        <button
                          type="button"
                          className={`h-6 px-2 inline-flex items-center justify-center rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${microLabelClass}`}
                          title="Use test-image-url"
                          onClick={() => {
                            setUrlDraft(WORKSPACE_IMPORT_IMAGE_URL_TEST)
                          }}
                        >
                          Test image
                        </button>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="flex items-stretch gap-1">
                    <input
                      ref={urlInputRef}
                      className={`flex-1 min-w-0 h-[var(--kg-control-height,28px)] px-2 rounded border box-border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${microLabelClass}`}
                      placeholder={SOURCE_FILES_COPY.urlPlaceholder}
                      value={urlDraft}
                      onChange={e => setUrlDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setUrlInputOpen(false)
                          return
                        }
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        const next = String(urlDraft || '').trim()
                        if (!next) return
                        props.onImportUrl?.(next)
                        setUrlInputOpen(false)
                      }}
                    />
                    {typeof props.onImportWebsite === 'function' ? (
                      <button
                        type="button"
                        className={`h-[var(--kg-control-height,28px)] w-[var(--kg-control-height,28px)] inline-flex items-center justify-center rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                        title="Import website (sitemap)"
                        aria-label="Import website"
                        onClick={() => {
                          const next = String(urlDraft || '').trim()
                          if (!next) return
                          props.onImportWebsite?.(next)
                          setUrlInputOpen(false)
                        }}
                      >
                        <Globe className="w-4 h-4" strokeWidth={1.6} />
                      </button>
                    ) : null}
                  </section>
                </section>
              </section>
            </li>
          ) : null}
        </>
      ) : null}
    </>
  )
}

