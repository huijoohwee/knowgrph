import React from 'react'
import { Armchair, Box, Building2, Car, PawPrint, Trash2, TreePine, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { renderAgenticOsInvocationKeywordChip } from '@/features/agentic-os/agenticOsInvocationChips'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import { renderMarkdownSigilInlineText } from '@/lib/ui/MarkdownSigilText'
import { PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { UI_INLINE_CHIP_GROUP_CLASSNAME } from '@/lib/ui/textLayout'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  type XrMotionReferenceStageId,
} from '@/features/three/xrMotionReferenceModel'
import {
  XR_SCENE_LIBRARY_ASSETS,
  XR_SCENE_LIBRARY_CATEGORY_LABELS,
  type XrSceneLibraryAsset,
  type XrSceneLibraryCategory,
} from '@/features/three/xrSceneLibrary'
import { readXrMotionReferenceRuntime, subscribeXrMotionReferenceRuntime } from '@/features/three/xrMotionReferenceRuntime'
import {
  buildXrPlaceInvocation,
  buildXrStageInvocation,
} from '@/features/three/xrSceneMcpContract.mjs'
import {
  controlLocalXrScene,
  type XrSceneTransition,
  type XrSceneControlInput,
} from '@/features/three/xrSceneMcpRuntime'
import { SpatialAssetToolsPanel } from '@/features/three/SpatialAssetToolsPanel'
import { buildXrAssetMediaDragPayload, buildXrStageMediaDragPayload } from '@/features/three/xrSceneMediaDrag'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
import { useCollapsibleSectionGroup } from '@/features/panels/ui/useCollapsibleSectionGroup'
import {
  continueMediaMouseDrag,
  continueMediaPointerDrag,
  finishMediaDrag,
  isMediaRowControlTarget,
  mediaListItemClassName,
  mediaListThumbnailFrameClassName,
  primeMediaMouseDrag,
  primeMediaPointerDrag,
  shouldHandleMediaRowPointer,
  shouldPrimeMediaRowDragPayload,
  startMediaDrag,
  startMediaMouseDrag,
  startMediaPointerDrag,
} from './mediaCatalogShared'

type XrSceneLibraryFilter = 'all' | XrSceneLibraryCategory

const CATEGORY_ICONS: Readonly<Record<XrSceneLibraryCategory, LucideIcon>> = {
  people: UserRound,
  animals: PawPrint,
  vehicles: Car,
  furniture: Armchair,
  props: Box,
}

const XR_LIBRARY_SECTION_KEYS = ['environments', 'subjects-props'] as const

function matchesSearch(searchText: string, values: readonly string[]): boolean {
  const tokens = String(searchText || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const haystack = values.join(' ').toLowerCase()
  return tokens.every(token => haystack.includes(token))
}

function XrCatalogThumb({ Icon, color }: { Icon: LucideIcon; color: string }) {
  return (
    <span
      className={cn('grid size-10 shrink-0 place-items-center rounded border', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.input.bg)}
      style={{ color }}
      role="img"
      aria-label="Procedural grey-box preview"
    >
      <Icon className="size-5" strokeWidth={1.6} aria-hidden />
    </span>
  )
}

function XrMediaCatalogThumb({ Icon, color, label }: { Icon: LucideIcon; color: string; label: string }) {
  return (
    <span
      className={mediaListThumbnailFrameClassName('items-center justify-center cursor-grab active:cursor-grabbing')}
      style={{ color }}
      role="img"
      aria-label={`${label} procedural grey-box preview`}
      data-kg-media-xr-thumbnail="media-card"
    >
      <Icon className="size-7" strokeWidth={1.6} aria-hidden />
    </span>
  )
}

function XrInvocationButton({ invocation, disabled, onInvoke }: { invocation: string; disabled: boolean; onInvoke: () => void }) {
  const compactInvocation = splitInvocationTokenSegments(invocation)
    .filter(segment => segment.kind === 'token')
    .map(segment => segment.value)
    .join(' ')
  return (
    <button
      type="button"
      className={cn('App-toolbar__btn', UI_INLINE_CHIP_GROUP_CLASSNAME, 'max-w-full overflow-hidden')}
      disabled={disabled}
      title={`Invoke ${invocation}`}
      aria-label={`Invoke ${invocation}`}
      onClick={onInvoke}
      data-kg-media-xr-invocation={invocation}
      data-kg-media-xr-invocation-chip-renderer="shared-markdown-sigil"
    >
      {renderMarkdownSigilInlineText(compactInvocation || invocation, {
        renderKeywordChip: ({ value, className }) => renderAgenticOsInvocationKeywordChip({ value, className, sourceLink: false }),
      })}
    </button>
  )
}

function XrLibraryCard({
  Icon,
  color,
  label,
  description,
  metadata,
  footer,
  dragPayload,
  active = false,
  dataAttributes,
}: {
  Icon: LucideIcon
  color: string
  label: string
  description: string
  metadata: string
  footer: React.ReactNode
  dragPayload: MediaDragPayload
  active?: boolean
  dataAttributes?: Record<string, string>
}) {
  return (
    <article
      draggable={true}
      className={cn(mediaListItemClassName(), active ? UI_THEME_TOKENS.button.activeBg : '')}
      title={`Drag ${label} onto the Canvas`}
      aria-label={`${label}. Drag onto the Canvas.`}
      data-kg-media-draggable="1"
      data-kg-media-drag-affordance="frame"
      data-kg-media-xr-draggable="1"
      data-kg-media-list-row-layout="3-rows"
      data-kg-media-xr-card-layout="media-3-rows"
      onDragStart={event => startMediaDrag(event, dragPayload)}
      onDragEnd={finishMediaDrag}
      onPointerDownCapture={event => {
        if (!shouldPrimeMediaRowDragPayload(event)) return
        primeMediaPointerDrag(event, dragPayload)
      }}
      onPointerDown={event => {
        if (!shouldHandleMediaRowPointer(event)) return
        startMediaPointerDrag(event, dragPayload)
      }}
      onPointerMove={event => {
        if (isMediaRowControlTarget(event.target)) return
        continueMediaPointerDrag(event, dragPayload)
      }}
      onMouseDownCapture={event => {
        if (!shouldPrimeMediaRowDragPayload(event)) return
        primeMediaMouseDrag(event, dragPayload)
      }}
      onMouseDown={event => {
        if (isMediaRowControlTarget(event.target)) return
        startMediaMouseDrag(event, dragPayload)
      }}
      onMouseMove={event => {
        if (isMediaRowControlTarget(event.target)) return
        continueMediaMouseDrag(event, dragPayload)
      }}
      {...dataAttributes}
    >
      <XrMediaCatalogThumb Icon={Icon} color={color} label={label} />
      <section className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1" aria-label={`${label} XR media summary`}>
        <header className="flex min-w-0 items-center justify-between gap-2" data-kg-media-list-row-section="title">
          <h4 className="truncate text-xs font-semibold" title={label}>{label}</h4>
        </header>
        <section className="grid min-w-0 gap-0.5" data-kg-media-list-row-section="meta">
          <p className={cn('m-0 line-clamp-2 text-[11px]', UI_THEME_TOKENS.text.secondary)} title={description}>{description}</p>
          <p className={cn('m-0 truncate text-[10px] uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary)} title={metadata}>{metadata}</p>
        </section>
        <footer className="flex min-w-0 items-center gap-1" data-kg-media-list-row-section="description">{footer}</footer>
      </section>
    </article>
  )
}

function XrAssetRow({
  asset,
  disabled,
  transition,
  onTransitionChange,
  onPlace,
}: {
  asset: XrSceneLibraryAsset
  disabled: boolean
  transition: XrSceneTransition
  onTransitionChange: (transition: XrSceneTransition) => void
  onPlace: (asset: XrSceneLibraryAsset, transition: XrSceneTransition) => void
}) {
  const Icon = CATEGORY_ICONS[asset.category]
  const invocation = buildXrPlaceInvocation(asset.id, asset.mobile ? transition : 'hold')
  return (
    <XrLibraryCard
      Icon={Icon}
      color={asset.defaultColor}
      label={asset.label}
      description={asset.description}
      metadata={`${asset.category} · ${asset.dimensionsMeters.join(' × ')} m · ${asset.mobile ? 'markable cast' : 'static reference'}`}
      dragPayload={buildXrAssetMediaDragPayload(asset, transition)}
      dataAttributes={{ 'data-kg-media-xr-asset': asset.id, 'data-kg-media-xr-asset-category': asset.category }}
      footer={(
        <>
          {asset.mobile ? (
            <PanelSelect
              className="w-20 shrink-0 text-[10px]"
              aria-label={`Path interpolation for ${asset.label}`}
              value={transition}
              onChange={event => onTransitionChange(event.target.value as XrSceneTransition)}
              data-kg-media-xr-asset-transition={asset.id}
            >
              <option value="linear">Travel</option>
              <option value="hold">Hold</option>
            </PanelSelect>
          ) : null}
          <XrInvocationButton invocation={invocation} disabled={disabled} onInvoke={() => onPlace(asset, transition)} />
        </>
      )}
    />
  )
}

export function XrMediaLibraryPanel({ searchText }: { searchText: string }) {
  const {
    graphData,
    markdownDocumentName,
    markdownDocumentText,
    pushUiToast,
  } = useGraphStore(useShallow(state => ({
    graphData: state.graphData,
    markdownDocumentName: state.markdownDocumentName,
    markdownDocumentText: state.markdownDocumentText,
    pushUiToast: state.pushUiToast,
  })))
  const runtime = React.useSyncExternalStore(subscribeXrMotionReferenceRuntime, readXrMotionReferenceRuntime, readXrMotionReferenceRuntime)
  const [categoryFilter, setCategoryFilter] = React.useState<XrSceneLibraryFilter>('all')
  const [nextLabel, setNextLabel] = React.useState('')
  const [assetTransitions, setAssetTransitions] = React.useState<Record<string, XrSceneTransition>>({})
  const [subjectLabelDrafts, setSubjectLabelDrafts] = React.useState<Record<string, string>>({})
  const {
    allCollapsed: allLibrarySectionsCollapsed,
    collapseAll: collapseAllLibrarySections,
    collapsedKeys: collapsedLibrarySectionKeys,
    expandAll: expandAllLibrarySections,
    setCollapsed: setLibrarySectionCollapsed,
  } = useCollapsibleSectionGroup(XR_LIBRARY_SECTION_KEYS)
  const sceneReady = Boolean(graphData && String(markdownDocumentName || '').trim() && String(markdownDocumentText || '').trim())
  const runControl = React.useCallback((input: XrSceneControlInput) => {
    const result = controlLocalXrScene(input)
    pushUiToast({
      id: result.ok ? 'media:xr-library:updated' : 'media:xr-library:error',
      kind: result.ok ? 'success' : sceneReady ? 'error' : 'warning',
      message: result.message,
    })
    return result
  }, [pushUiToast, sceneReady])

  const selectEnvironment = React.useCallback((stageId: XrMotionReferenceStageId) => {
    runControl({ action: 'stage', stageId })
  }, [runControl])

  const placeAsset = React.useCallback((asset: XrSceneLibraryAsset, transition: XrSceneTransition) => {
    const result = runControl({ action: 'place', assetId: asset.id, label: nextLabel, transition })
    if (result.ok) setNextLabel('')
  }, [nextLabel, runControl])

  const commitSubjectLabel = React.useCallback((subjectId: string) => {
    const nextValue = String(subjectLabelDrafts[subjectId] || '').trim()
    if (!nextValue) return
    runControl({ action: 'label', subjectId, label: nextValue })
  }, [runControl, subjectLabelDrafts])

  const removeSubject = React.useCallback((subjectId: string) => {
    runControl({ action: 'remove', subjectId })
  }, [runControl])

  const setSubjectTransition = React.useCallback((subjectId: string, transition: XrSceneTransition) => {
    runControl({ action: 'transition', subjectId, transition })
  }, [runControl])

  const visibleEnvironments = React.useMemo(() => XR_MOTION_REFERENCE_STAGE_PRESETS.filter(stage => matchesSearch(searchText, [stage.label, stage.description, 'environment kit xr 3d'])), [searchText])
  const visibleAssets = React.useMemo(() => XR_SCENE_LIBRARY_ASSETS.filter(asset => (
    (categoryFilter === 'all' || asset.category === categoryFilter)
    && matchesSearch(searchText, [asset.label, asset.category, asset.description, ...asset.keywords, asset.mobile ? 'cast marks motion' : 'static'])
  )), [categoryFilter, searchText])

  return (
    <section className="grid min-w-0 gap-3" aria-label="3D for XR library" data-kg-media-xr-library="1" data-kg-media-xr-assets-mcp="knowgrph.control_local_xr_scene" data-kg-media-xr-scene-ready={sceneReady ? '1' : '0'}>
      <header className={cn('grid gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}>
        <section className="flex items-start gap-2">
          <XrCatalogThumb Icon={Building2} color="#38bdf8" />
          <section className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold">3D for XR</h3>
            <p className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>Native grey-box kits and procedural subjects. No external assets or runtime dependency.</p>
            <p className={cn('mt-0.5 truncate font-mono text-[9px]', UI_THEME_TOKENS.text.tertiary)} title="Browser WebMCP control tool">WebMCP · knowgrph.control_local_xr_scene</p>
          </section>
          <section className="flex shrink-0 items-center gap-1">
            <output className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{runtime.plan.subjects.length} placed</output>
            <ExpandCollapseAllButton
              allCollapsed={allLibrarySectionsCollapsed}
              onExpandAll={expandAllLibrarySections}
              onCollapseAll={collapseAllLibrarySections}
              titleExpand="Expand All XR library sections"
              titleCollapse="Collapse All XR library sections"
            />
          </section>
        </section>
        {!sceneReady ? <p className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">Open or create a graph document to place and persist XR scene media.</p> : null}
        <label className="grid gap-1 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Label next subject</span>
          <PanelTextInput value={nextLabel} maxLength={80} placeholder="Optional subject label, e.g. THIEF" onChange={event => setNextLabel(event.target.value)} data-kg-media-xr-next-label="1" />
        </label>
      </header>

      <CollapsibleSection
        title={<span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase">Environment Kits</span><output className={cn('shrink-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{visibleEnvironments.length}</output></span>}
        collapsed={collapsedLibrarySectionKeys.has('environments')}
        onToggle={collapsed => setLibrarySectionCollapsed('environments', collapsed)}
        defaultCollapsed={false}
        flushTop
        headerClassName="px-0"
        className="mt-1 border-t pt-1"
        id="xr-media-environment-kits"
      >
        <section className="grid gap-2" aria-label="XR environment kits" data-kg-media-xr-environments="1">
          <section className="grid gap-1">
            {visibleEnvironments.map(stage => {
              const active = runtime.plan.stageId === stage.id
              return (
                <XrLibraryCard
                  key={stage.id}
                  Icon={stage.id === 'aerial-sky' ? TreePine : Building2}
                  color={active ? '#38bdf8' : '#94a3b8'}
                  label={stage.label}
                  description={stage.description}
                  metadata={`environment · ${stage.sizeMeters.join(' × ')} m · grey-box stage`}
                  dragPayload={buildXrStageMediaDragPayload(stage)}
                  active={active}
                  dataAttributes={{ 'data-kg-media-xr-environment': stage.id }}
                  footer={<XrInvocationButton invocation={buildXrStageInvocation(stage.id)} disabled={!sceneReady} onInvoke={() => selectEnvironment(stage.id)} />}
                />
              )
            })}
          </section>
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        title={<span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[11px] font-semibold uppercase">Subjects &amp; Props</span><output className={cn('shrink-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{visibleAssets.length}</output></span>}
        collapsed={collapsedLibrarySectionKeys.has('subjects-props')}
        onToggle={collapsed => setLibrarySectionCollapsed('subjects-props', collapsed)}
        defaultCollapsed={false}
        headerClassName="px-0"
        className="mt-1 border-t pt-1"
        id="xr-media-subjects-props"
      >
        <section className="grid gap-2" aria-label="XR subject library" data-kg-media-xr-subject-library="1">
          <header className="grid gap-2">
            <nav className="flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="XR library categories">
              {(['all', 'people', 'animals', 'vehicles', 'furniture', 'props'] as const).map(category => {
                const Icon = category === 'all' ? UsersRound : CATEGORY_ICONS[category]
                const label = category === 'all' ? 'All' : XR_SCENE_LIBRARY_CATEGORY_LABELS[category]
                return <button key={category} type="button" className={cn('App-toolbar__btn inline-flex shrink-0 items-center gap-1', categoryFilter === category ? UI_THEME_TOKENS.button.activeBg : '')} aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)} data-kg-media-xr-category={category}><Icon className="size-3" aria-hidden />{label}</button>
              })}
            </nav>
          </header>
          <section className="grid gap-1">{visibleAssets.map(asset => <XrAssetRow key={asset.id} asset={asset} disabled={!sceneReady} transition={assetTransitions[asset.id] || 'linear'} onTransitionChange={transition => setAssetTransitions(current => ({ ...current, [asset.id]: transition }))} onPlace={placeAsset} />)}</section>
        </section>
      </CollapsibleSection>

      {runtime.plan.subjects.length ? (
        <section className="grid gap-2" aria-label="Placed XR subjects" data-kg-media-xr-placed-subjects="1">
          <h3 className="text-[11px] font-semibold uppercase">Placed Subjects</h3>
          {runtime.plan.subjects.map(subject => (
            <article key={subject.id} className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-media-xr-placed-subject={subject.id}>
              <XrCatalogThumb Icon={CATEGORY_ICONS[subject.category]} color={subject.color} />
              <label className="grid min-w-0 gap-0.5 text-[10px]"><span className={UI_THEME_TOKENS.text.tertiary}>{subject.assetId}</span><PanelTextInput value={subjectLabelDrafts[subject.id] ?? subject.label} maxLength={80} onChange={event => setSubjectLabelDrafts(current => ({ ...current, [subject.id]: event.target.value }))} onBlur={() => commitSubjectLabel(subject.id)} aria-label={`Label ${subject.label}`} data-kg-media-xr-subject-label={subject.id} /></label>
              {runtime.plan.cast.some(track => track.actorId === subject.id) ? <PanelSelect className="w-20 text-[10px]" aria-label={`Path interpolation for ${subject.label}`} value={runtime.plan.cast.find(track => track.actorId === subject.id)?.marks[0]?.transition === 'hold' ? 'hold' : 'linear'} onChange={event => setSubjectTransition(subject.id, event.target.value as XrSceneTransition)} data-kg-media-xr-subject-transition={subject.id}><option value="linear">Travel</option><option value="hold">Hold</option></PanelSelect> : <span className={cn('text-[9px]', UI_THEME_TOKENS.text.tertiary)}>Static</span>}
              <button type="button" className="App-toolbar__btn" aria-label={`Remove ${subject.label}`} title={`Remove ${subject.label}`} onClick={() => removeSubject(subject.id)} data-kg-media-xr-remove-subject={subject.id}><Trash2 className="size-3.5" aria-hidden /></button>
            </article>
          ))}
        </section>
      ) : null}

      <SpatialAssetToolsPanel />
    </section>
  )
}
