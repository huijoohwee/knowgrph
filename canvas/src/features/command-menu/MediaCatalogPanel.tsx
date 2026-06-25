import React from 'react'
import { INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID, INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID, INLINE_VARIABLE_COMMAND_ACTIONS } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { type CommandMenuRichMediaItem, renameCommandMenuRichMediaMarkdownHref, useCommandMenuRichMediaInventory } from '@/lib/command-menu/commandMenuRichMediaInventory'
import { readCommandMenuMediaNameDraft, useCommandMenuMediaNameDrafts, writeCommandMenuMediaNameDraft } from '@/lib/command-menu/commandMenuMediaNameSync'
import { useGraphStore } from '@/hooks/useGraphStore'
import { writeWorkspaceSourceTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import { deleteUploadedMediaFromKnowgrphStorage, listUploadedMediaFromKnowgrphStorage, renameUploadedMediaInKnowgrphStorage, type UploadedMediaStorageResult } from '@/lib/storage/uploadedMediaStorage'
import { buildUploadedMediaPanelItemFromStorage, buildUploadedMediaPanelItemId, mergeUploadedMediaPanelItems, readStoredUploadedMediaPanelItems, readUploadedMediaFileName, readUploadedMediaPanelDedupeKey, UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, writeStoredUploadedMediaPanelItems, type UploadedMediaPanelItem } from '@/lib/storage/uploadedMediaPanelItems'
import { uploadFilesToUploadedMediaPanel } from '@/lib/storage/uploadedMediaPanelUpload'
import { importUrlToUploadedMediaPanel } from '@/lib/storage/uploadedMediaPanelImportUrl'
import { UI_TOAST_TTL_MS } from '@/lib/ui/toastTiming'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { buildMediaLightboxPromptParameters } from '@/lib/ui/mediaLightboxPromptParameters'
import { insertMediaIntoActiveCardInlineTextEditor } from '@/lib/cards/cardInlineTextExternalCommands'
import { MEDIA_LIBRARY_OPEN_TOP_EVENT } from '@/features/canvas/utils'
import { MediaCatalogPanelView } from './MediaCatalogPanelView'
import { MEDIA_GENERATE_MEDIA_ACTION_ID, MEDIA_IMPORT_URL_ACTION_ID, MEDIA_NEW_ACTIONS, readStoredMediaCatalogLayout, readStoredMediaDescriptionDrafts, readStoredMediaFieldDrafts, writeStoredMediaCatalogLayout, writeStoredMediaDescriptionDrafts, writeStoredMediaFieldDrafts, type MediaCatalogLayout, type MediaPanelActionSpec, type UploadedMediaDescriptionDrafts, type UploadedMediaFieldDrafts } from './mediaCatalogTypes'
import { buildUploadedMediaMarkdown } from './mediaCatalogUploadedItems'
import { getUploadedMediaDescriptionKey, buildCommandMenuMediaDragPayload, buildUploadedMediaDragPayload, getMediaNameSyncKey, readRichMediaInsertUrl, startMediaDrag } from './mediaCatalogShared'

export function MediaCatalogPanel() {

  const panelTypography = usePanelTypography()
  const panelRef = React.useRef<HTMLElement | null>(null)
  const mediaListRef = React.useRef<HTMLElement | null>(null)
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = React.useRef<Set<string>>(new Set())
  const [catalogLayout, setCatalogLayoutState] = React.useState<MediaCatalogLayout>(readStoredMediaCatalogLayout)
  const [uploadedMediaItems, setUploadedMediaItems] = React.useState<UploadedMediaPanelItem[]>(readStoredUploadedMediaPanelItems)
  const [mediaDescriptionDrafts, setMediaDescriptionDrafts] = React.useState<UploadedMediaDescriptionDrafts>(readStoredMediaDescriptionDrafts)
  const [mediaFieldDrafts, setMediaFieldDrafts] = React.useState<UploadedMediaFieldDrafts>(readStoredMediaFieldDrafts)
  const [lightboxItem, setLightboxItem] = React.useState<UploadedMediaPanelItem | null>(null)
  const [generateLightboxOpen, setGenerateLightboxOpen] = React.useState(false)
  const [generateMediaPrompt, setGenerateMediaPrompt] = React.useState('')
  const [importUrlPromptOpen, setImportUrlPromptOpen] = React.useState(false)
  const [importUrlDraft, setImportUrlDraft] = React.useState('')
  const [importUrlBusy, setImportUrlBusy] = React.useState(false)
  const setActiveMediaKey = useGraphStore(s => s.setMarkdownPreviewActiveMediaKey)
  const setMermaidFocus = useGraphStore(s => s.setMarkdownPreviewMermaidFocus)
  const selectNode = useGraphStore(s => s.selectNode)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const updateNode = useGraphStore(s => s.updateNode)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText || '')
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const setSourceFiles = useGraphStore(s => s.setSourceFiles)
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const { items } = useCommandMenuRichMediaInventory()
  const uploadedMediaKeys = React.useMemo(() => new Set(uploadedMediaItems.flatMap(item => {
    const storage = item.storage
    if (!storage) return []
    return [
      storage.contentHash,
      storage.objectKey,
      storage.publicPath,
      storage.publicUrl.split('?')[0] || storage.publicUrl,
      storage.accessUrl.split('?')[0] || storage.accessUrl,
    ].map(value => String(value || '').trim()).filter(Boolean)
  })), [uploadedMediaItems])
  const mediaItems = React.useMemo(
    () => items.filter(item => {
      if (item.kind === 'mermaid') return false
      const candidate = [item.openUrl, item.src, item.thumbnailUrl].map(value => String(value || '').split('?')[0] || String(value || ''))
      return !candidate.some(value => uploadedMediaKeys.has(value.trim()))
    }),
    [items, uploadedMediaKeys],
  )
  const mediaNameDrafts = useCommandMenuMediaNameDrafts()
  const mediaActions = React.useMemo(
    () => [
      ...MEDIA_NEW_ACTIONS,
      ...INLINE_VARIABLE_COMMAND_ACTIONS.filter(action => action.id === 'insert-image' || action.id === 'insert-video'),
    ],
    [],
  )
  const generatePromptParameters = React.useMemo(
    () => buildMediaLightboxPromptParameters({ kind: 'image' }),
    [],
  )
  const scrollMediaPanelToTop = React.useCallback((behavior: ScrollBehavior = 'auto') => {
    try {
      panelRef.current?.scrollTo?.({ top: 0, behavior })
    } catch {
      if (panelRef.current) panelRef.current.scrollTop = 0
    }
    mediaListRef.current?.focus?.({ preventScroll: true })
  }, [])
  const openMediaLibraryTop = React.useCallback(() => {
    const run = () => {
      scrollMediaPanelToTop('smooth')
    }
    if (typeof window === 'undefined') {
      run()
      return
    }
    window.requestAnimationFrame(run)
  }, [scrollMediaPanelToTop])
  const setCatalogLayout = React.useCallback((layout: MediaCatalogLayout) => {
    setCatalogLayoutState(layout)
    writeStoredMediaCatalogLayout(layout)
  }, [])
  React.useEffect(() => () => {
    objectUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        void 0
      }
    })
    objectUrlsRef.current.clear()
  }, [])
  React.useEffect(() => {
    let cancelled = false
    listUploadedMediaFromKnowgrphStorage().then(storageItems => {
      if (cancelled || storageItems.length === 0) return
      const cloudflareItems = storageItems
        .map(buildUploadedMediaPanelItemFromStorage)
        .filter((item): item is UploadedMediaPanelItem => !!item)
      if (cloudflareItems.length === 0) return
      setUploadedMediaItems(prev => {
        const next = mergeUploadedMediaPanelItems([...cloudflareItems, ...prev.map(item => (
          item.status === 'synced' ? { ...item, linkUrl: item.storage?.accessUrl || item.linkUrl } : item
        ))])
        writeStoredUploadedMediaPanelItems(next)
        return next
      })
    }).catch(() => {
      void 0
    })
    return () => {
      cancelled = true
    }
  }, [])
  React.useEffect(() => {
    const onItemsChanged = () => setUploadedMediaItems(readStoredUploadedMediaPanelItems())
    window.addEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    return () => {
      window.removeEventListener(UPLOADED_MEDIA_PANEL_ITEMS_CHANGED_EVENT, onItemsChanged)
    }
  }, [])
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener(MEDIA_LIBRARY_OPEN_TOP_EVENT, openMediaLibraryTop)
    return () => {
      window.removeEventListener(MEDIA_LIBRARY_OPEN_TOP_EVENT, openMediaLibraryTop)
    }
  }, [openMediaLibraryTop])
  React.useEffect(() => {
    scrollMediaPanelToTop('auto')
  }, [catalogLayout, mediaItems.length, scrollMediaPanelToTop, uploadedMediaItems.length])
  const appendSyncedUploadedMediaSource = React.useCallback((args: {
    itemId: string
    name: string
    kind: UploadedMediaPanelItem['kind']
    storage: UploadedMediaStorageResult
  }) => {
    const sourceId = `media-upload:${args.storage.contentHash}`
    const currentSourceFiles = useGraphStore.getState().sourceFiles || []
    if (currentSourceFiles.some(file => String(file?.id || '') === sourceId)) return
    const text = buildUploadedMediaMarkdown({
      name: args.name,
      kind: args.kind,
      url: args.storage.accessUrl,
      contentHash: args.storage.contentHash,
      objectKey: args.storage.objectKey,
    })
    const nextFile = {
      id: sourceId,
      name: `${args.name || args.itemId}.media.md`,
      text,
      enabled: true,
      geoLayerEnabled: false,
      status: 'idle' as const,
      parsedTextHash: '',
      source: {
        kind: 'local' as const,
        path: `workspace:/media/${args.storage.objectKey}.md`,
      },
    }
    setSourceFiles([...currentSourceFiles, nextFile])
  }, [setSourceFiles])
  const handleUploadMediaFiles = React.useCallback(async (fileList: FileList | null) => {
    await uploadFilesToUploadedMediaPanel({
      files: Array.from(fileList || []),
      setItems: setUploadedMediaItems,
      registerObjectUrl: url => objectUrlsRef.current.add(url),
      onSynced: ({ item, storage }) => {
        appendSyncedUploadedMediaSource({ itemId: item.id, name: item.name, kind: item.kind, storage })
      },
    })
  }, [appendSyncedUploadedMediaSource])
  const handleImportMediaUrl = React.useCallback(async (urlRaw: string) => {
    const url = String(urlRaw || '').trim()
    if (!url || importUrlBusy) return
    setImportUrlBusy(true)
    pushUiToast({
      id: 'media:import-url',
      kind: 'neutral',
      message: 'Importing media URL…',
      ttlMs: null,
      dismissible: false,
      busy: true,
    })
    try {
      const results = await importUrlToUploadedMediaPanel({
        urlRaw: url,
        setItems: setUploadedMediaItems,
        registerObjectUrl: objectUrl => objectUrlsRef.current.add(objectUrl),
        onSynced: ({ item, storage }) => {
          appendSyncedUploadedMediaSource({ itemId: item.id, name: item.name, kind: item.kind, storage })
        },
      })
      if (results.length === 0) throw new Error('URL did not resolve to image, audio, or video media')
      setImportUrlDraft('')
      setImportUrlPromptOpen(false)
      pushUiToast({
        id: 'media:import-url',
        kind: 'success',
        message: `Imported ${results.length} media URL${results.length === 1 ? '' : 's'}`,
        ttlMs: UI_TOAST_TTL_MS.actionFeedback,
        dismissible: false,
      })
    } catch (error) {
      pushUiToast({
        id: 'media:import-url',
        kind: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Request failed'}`,
        ttlMs: UI_TOAST_TTL_MS.warningExtended,
        dismissible: true,
      })
    } finally {
      setImportUrlBusy(false)
    }
  }, [appendSyncedUploadedMediaSource, importUrlBusy, pushUiToast])
  const handleSelectMedia = React.useCallback((item: CommandMenuRichMediaItem) => {
    if (item.kind === 'image' || item.kind === 'audio' || item.kind === 'video') {
      const inserted = insertMediaIntoActiveCardInlineTextEditor({
        kind: item.kind,
        url: readRichMediaInsertUrl(item),
        label: readCommandMenuMediaNameDraft(mediaNameDrafts, getMediaNameSyncKey(item)) || item.label,
        sourceKey: item.key,
      })
      if (inserted) return
    }
    setMermaidFocus(null)
    setActiveMediaKey(item.key)
    if (item.source === 'graph' && item.nodeId) {
      setSelectionSource('toolbar')
      selectNode(item.nodeId)
    }
  }, [mediaNameDrafts, selectNode, setActiveMediaKey, setMermaidFocus, setSelectionSource])
  const handleMediaNameDraftChange = React.useCallback((item: CommandMenuRichMediaItem, nextName: string) => {
    const syncKey = getMediaNameSyncKey(item)
    writeCommandMenuMediaNameDraft(syncKey, nextName)
  }, [])
  const removeUploadedMediaSources = React.useCallback((storage: UploadedMediaStorageResult) => {
    const artifactSourceId = `media-upload:${storage.contentHash}`
    const nextSourceFiles = sourceFiles.filter(file => {
      const id = String(file?.id || '')
      const text = String(file?.text || '')
      return id !== artifactSourceId && !text.includes(storage.contentHash) && !text.includes(storage.objectKey)
    })
    if (nextSourceFiles.length !== sourceFiles.length) setSourceFiles(nextSourceFiles)
  }, [setSourceFiles, sourceFiles])
  const renameUploadedMediaSources = React.useCallback((storage: UploadedMediaStorageResult, nextName: string) => {
    const artifactSourceId = `media-upload:${storage.contentHash}`
    const nextSourceFiles = sourceFiles.map(file => {
      const id = String(file?.id || '')
      const text = String(file?.text || '')
      if (id !== artifactSourceId && !text.includes(storage.contentHash) && !text.includes(storage.objectKey)) return file
      const renamedText = buildUploadedMediaMarkdown({
        name: nextName,
        kind: storage.stageId === 'audio' || storage.stageId === 'video' ? storage.stageId : 'image',
        url: storage.accessUrl,
        contentHash: storage.contentHash,
        objectKey: storage.objectKey,
      })
      const nextFile = { ...file, name: `${nextName}.media.md`, text: renamedText, parsedTextHash: '' }
      writeWorkspaceSourceTextIfPresent(nextFile, renamedText, 'Command Menu uploaded media rename')
      return nextFile
    })
    setSourceFiles(nextSourceFiles)
  }, [setSourceFiles, sourceFiles])
  const handleUploadedMediaNameChange = React.useCallback((item: UploadedMediaPanelItem, nextName: string) => {
    setUploadedMediaItems(prev => prev.map(candidate => candidate.id === item.id ? { ...candidate, name: nextName } : candidate))
  }, [])
  const handleUploadedMediaDescriptionChange = React.useCallback((item: UploadedMediaPanelItem, nextDescription: string) => {
    const descriptionKey = getUploadedMediaDescriptionKey(item)
    const description = String(nextDescription || '')
    setMediaDescriptionDrafts(prev => {
      const next = { ...prev }
      if (description.trim()) {
        next[descriptionKey] = description
      } else {
        delete next[descriptionKey]
      }
      writeStoredMediaDescriptionDrafts(next)
      return next
    })
  }, [])
  const handleUploadedMediaFieldChange = React.useCallback((item: UploadedMediaPanelItem, nextFieldText: string) => {
    const fieldKey = getUploadedMediaDescriptionKey(item)
    const fieldText = String(nextFieldText || '')
    setMediaFieldDrafts(prev => {
      const next = { ...prev }
      if (fieldText.trim()) {
        next[fieldKey] = fieldText
      } else {
        delete next[fieldKey]
      }
      writeStoredMediaFieldDrafts(next)
      return next
    })
  }, [])
  const handleRenameUploadedMedia = React.useCallback((item: UploadedMediaPanelItem, nextName: string) => {
    const name = String(nextName || '').trim()
    if (!name || !item.storage) return
    setUploadedMediaItems(prev => {
      const next = prev.map(candidate => candidate.id === item.id ? { ...candidate, name } : candidate)
      writeStoredUploadedMediaPanelItems(next)
      return next
    })
    renameUploadedMediaSources(item.storage, name)
    void renameUploadedMediaInKnowgrphStorage({ storage: item.storage, name }).then(storage => {
      if (!storage) return
      setUploadedMediaItems(prev => {
        const next = mergeUploadedMediaPanelItems(prev.map(candidate => (
          candidate.id === item.id || readUploadedMediaPanelDedupeKey(candidate) === storage.contentHash
            ? { ...candidate, id: buildUploadedMediaPanelItemId(storage), name: readUploadedMediaFileName(storage), linkUrl: storage.accessUrl, storage }
            : candidate
        )))
        writeStoredUploadedMediaPanelItems(next)
        return next
      })
    }).catch(() => {
      void 0
    })
  }, [renameUploadedMediaSources])
  const handleDeleteUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    setUploadedMediaItems(prev => {
      const next = prev.filter(candidate => readUploadedMediaPanelDedupeKey(candidate) !== readUploadedMediaPanelDedupeKey(item))
      writeStoredUploadedMediaPanelItems(next)
      return next
    })
    if (!item.storage) return
    removeUploadedMediaSources(item.storage)
    void deleteUploadedMediaFromKnowgrphStorage({ storage: item.storage }).catch(() => {
      void 0
    })
  }, [removeUploadedMediaSources])
  const handleSelectUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    if (!item.storage || item.status !== 'synced') return
    appendSyncedUploadedMediaSource({ itemId: item.id, name: item.name, kind: item.kind, storage: item.storage })
    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: item.kind,
      url: item.storage.accessUrl || item.linkUrl,
      label: item.name,
      sourceKey: item.storage.contentHash,
    })
    if (inserted) return
    setMermaidFocus(null)
    setActiveMediaKey(`media-upload:${item.storage.contentHash}`)
  }, [appendSyncedUploadedMediaSource, setActiveMediaKey, setMermaidFocus])
  const handlePreviewUploadedMedia = React.useCallback((item: UploadedMediaPanelItem) => {
    setLightboxItem(item)
  }, [])
  const handleDragCommandMenuMedia = React.useCallback((event: React.DragEvent<HTMLElement>, item: CommandMenuRichMediaItem) => {
    startMediaDrag(event, buildCommandMenuMediaDragPayload(item))
  }, [])
  const handleDragUploadedMedia = React.useCallback((event: React.DragEvent<HTMLElement>, item: UploadedMediaPanelItem) => {
    startMediaDrag(event, buildUploadedMediaDragPayload(item))
  }, [])
  const handleSelectMediaAction = React.useCallback((action: MediaPanelActionSpec) => {
    if (action.id === INLINE_UPLOAD_MEDIA_VARIABLE_ACTION_ID) {
      uploadInputRef.current?.click()
      return
    }
    if (action.id === MEDIA_IMPORT_URL_ACTION_ID) {
      setImportUrlPromptOpen(true)
      return
    }
    if (action.id === MEDIA_GENERATE_MEDIA_ACTION_ID) {
      setGenerateLightboxOpen(true)
      return
    }
    const mediaKind = INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID[action.id as keyof typeof INLINE_MEDIA_INSERT_KIND_BY_VARIABLE_ACTION_ID]
    if (!mediaKind) return
    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: mediaKind,
      url: '',
      label: action.label,
      sourceKey: action.id,
    })
    if (inserted) return
    setMermaidFocus(null)
  }, [setMermaidFocus])
  const handleRenameMedia = React.useCallback((item: CommandMenuRichMediaItem, nextName: string) => {
    const owner = item.renameOwner
    const name = String(nextName || '').trim()
    if (!owner || !name) return
    const mediaNameSyncKey = getMediaNameSyncKey(item)
    const markdownRenameItem: CommandMenuRichMediaItem = owner.type === 'markdownLine'
      ? item
      : mediaNameSyncKey
        ? {
            ...item,
            renameOwner: {
              type: 'markdownLine',
              startLine: item.startLine || 1,
              href: mediaNameSyncKey,
              syntax: 'link',
            },
          }
        : item
    if (owner.type === 'graphNodeLabel') {
      updateNode(owner.nodeId, { label: name })
    }
    const nextText = renameCommandMenuRichMediaMarkdownHref({
      markdownText: markdownDocumentText,
      item: markdownRenameItem,
      nextName: name,
    })
    let sourceFilesChanged = false
    const nextSourceFiles = sourceFiles.map(file => {
      const fileText = String(file?.text || '')
      const renamedText = renameCommandMenuRichMediaMarkdownHref({
        markdownText: fileText,
        item: markdownRenameItem,
        nextName: name,
      })
      if (renamedText === fileText) return file
      sourceFilesChanged = true
      const nextFile = { ...file, text: renamedText, parsedTextHash: '' }
      writeWorkspaceSourceTextIfPresent(nextFile, renamedText, 'Command Menu media rename')
      return nextFile
    })
    if (sourceFilesChanged) setSourceFiles(nextSourceFiles)
    if (nextText !== markdownDocumentText) {
      setMarkdownDocument(markdownDocumentName, nextText, { applyViewPreset: false })
    }
  }, [markdownDocumentName, markdownDocumentText, setMarkdownDocument, setSourceFiles, sourceFiles, updateNode])
  return (
    <MediaCatalogPanelView
      catalogLayout={catalogLayout}
      generateLightboxOpen={generateLightboxOpen}
      generateMediaPrompt={generateMediaPrompt}
      generatePromptParameters={generatePromptParameters}
      importUrlBusy={importUrlBusy}
      importUrlDraft={importUrlDraft}
      importUrlPromptOpen={importUrlPromptOpen}
      lightboxItem={lightboxItem}
      mediaActions={mediaActions}
      mediaDescriptionDrafts={mediaDescriptionDrafts}
      mediaFieldDrafts={mediaFieldDrafts}
      mediaItems={mediaItems}
      mediaListRef={mediaListRef}
      mediaNameDrafts={mediaNameDrafts}
      panelRef={panelRef}
      panelTextClass={panelTypography.panelTextClass}
      uploadInputRef={uploadInputRef}
      uploadedMediaItems={uploadedMediaItems}
      onCloseGenerateLightbox={() => setGenerateLightboxOpen(false)}
      onCloseLightbox={() => setLightboxItem(null)}
      onDeleteUploadedMedia={handleDeleteUploadedMedia}
      onDescriptionChange={handleUploadedMediaDescriptionChange}
      onDragCommandMenuMedia={handleDragCommandMenuMedia}
      onDragUploadedMedia={handleDragUploadedMedia}
      onFieldChange={handleUploadedMediaFieldChange}
      onGeneratePromptChange={setGenerateMediaPrompt}
      onGeneratePromptSubmit={nextPrompt => setGenerateMediaPrompt(nextPrompt)}
      onImportUrlChange={setImportUrlDraft}
      onImportUrlConfirm={handleImportMediaUrl}
      onImportUrlPromptOpenChange={setImportUrlPromptOpen}
      onLayoutChange={setCatalogLayout}
      onMediaNameDraftChange={handleMediaNameDraftChange}
      onNameChange={handleUploadedMediaNameChange}
      onNewMedia={openMediaLibraryTop}
      onPreviewUploadedMedia={handlePreviewUploadedMedia}
      onRenameMedia={handleRenameMedia}
      onRenameUploadedMedia={handleRenameUploadedMedia}
      onSelectMedia={handleSelectMedia}
      onSelectMediaAction={handleSelectMediaAction}
      onSelectUploadedMedia={handleSelectUploadedMedia}
      onUploadMediaFiles={handleUploadMediaFiles}
    />
  )
}

export default MediaCatalogPanel
