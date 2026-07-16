import React from 'react'
import { Armchair, Box, Building2, Car, PawPrint, Trash2, TreePine, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { PanelSelect, PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import {
  XR_MOTION_REFERENCE_GRAPH_METADATA_KEY,
  XR_MOTION_REFERENCE_STAGE_PRESETS,
  xrMotionReferenceSceneKey,
  type XrMotionReferenceStageId,
} from '@/features/three/xrMotionReferenceModel'
import {
  XR_SCENE_LIBRARY_ASSETS,
  XR_SCENE_LIBRARY_CATEGORY_LABELS,
  type XrSceneLibraryAsset,
  type XrSceneLibraryCategory,
} from '@/features/three/xrSceneLibrary'
import {
  hydrateXrMotionReferenceRuntime,
  readXrMotionReferenceRuntime,
  subscribeXrMotionReferenceRuntime,
} from '@/features/three/xrMotionReferenceRuntime'
import {
  buildXrPlaceInvocation,
  buildXrStageInvocation,
} from '@/features/three/xrSceneMcpContract.mjs'
import {
  controlLocalXrScene,
  type XrSceneAnimation,
  type XrSceneControlInput,
} from '@/features/three/xrSceneMcpRuntime'

type XrSceneLibraryFilter = 'all' | XrSceneLibraryCategory

const CATEGORY_ICONS: Readonly<Record<XrSceneLibraryCategory, LucideIcon>> = {
  people: UserRound,
  animals: PawPrint,
  vehicles: Car,
  furniture: Armchair,
  props: Box,
}

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

function XrInvocationButton({ invocation, disabled, onInvoke }: { invocation: string; disabled: boolean; onInvoke: () => void }) {
  return (
    <button
      type="button"
      className="App-toolbar__btn flex min-w-0 max-w-full items-center gap-1 overflow-hidden"
      disabled={disabled}
      title={`Invoke ${invocation}`}
      aria-label={`Invoke ${invocation}`}
      onClick={onInvoke}
      data-kg-media-xr-invocation={invocation}
    >
      {invocation.split(/\s+/).map(token => <code key={token} className="truncate text-[9px]">{token}</code>)}
    </button>
  )
}

function XrAssetRow({
  asset,
  disabled,
  motion,
  onMotionChange,
  onPlace,
}: {
  asset: XrSceneLibraryAsset
  disabled: boolean
  motion: XrSceneAnimation
  onMotionChange: (motion: XrSceneAnimation) => void
  onPlace: (asset: XrSceneLibraryAsset, motion: XrSceneAnimation) => void
}) {
  const Icon = CATEGORY_ICONS[asset.category]
  const invocation = buildXrPlaceInvocation(asset.id, asset.mobile ? motion : 'hold')
  return (
    <article
      className={cn('grid min-w-0 gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)}
      data-kg-media-xr-asset={asset.id}
      data-kg-media-xr-asset-category={asset.category}
    >
      <section className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <XrCatalogThumb Icon={Icon} color={asset.defaultColor} />
        <section className="min-w-0">
          <h4 className="truncate text-[11px] font-semibold">{asset.label}</h4>
          <p className={cn('line-clamp-2 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{asset.description}</p>
          <p className={cn('truncate text-[9px] uppercase tracking-wide', UI_THEME_TOKENS.text.tertiary)}>
            {asset.category} · {asset.dimensionsMeters.join(' × ')} m · {asset.mobile ? 'markable cast' : 'static reference'}
          </p>
        </section>
      </section>
      <footer className="flex min-w-0 items-center gap-1">
        {asset.mobile ? (
          <PanelSelect
            className="w-20 shrink-0 text-[10px]"
            aria-label={`Animation for ${asset.label}`}
            value={motion}
            onChange={event => onMotionChange(event.target.value as XrSceneAnimation)}
            data-kg-media-xr-asset-motion={asset.id}
          >
            <option value="travel">Travel</option>
            <option value="hold">Hold</option>
          </PanelSelect>
        ) : null}
        <XrInvocationButton invocation={invocation} disabled={disabled} onInvoke={() => onPlace(asset, motion)} />
      </footer>
    </article>
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
  const [assetMotions, setAssetMotions] = React.useState<Record<string, XrSceneAnimation>>({})
  const [subjectLabelDrafts, setSubjectLabelDrafts] = React.useState<Record<string, string>>({})
  const sceneReady = Boolean(graphData && String(markdownDocumentName || '').trim() && String(markdownDocumentText || '').trim())
  const sceneKey = React.useMemo(() => xrMotionReferenceSceneKey(markdownDocumentName || 'Untitled', graphData), [graphData, markdownDocumentName])

  React.useEffect(() => {
    if (!sceneReady || !graphData) return
    hydrateXrMotionReferenceRuntime({
      sceneKey,
      nodes: graphData.nodes,
      persistedValue: graphData.metadata?.[XR_MOTION_REFERENCE_GRAPH_METADATA_KEY],
    })
  }, [graphData, sceneKey, sceneReady])

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

  const placeAsset = React.useCallback((asset: XrSceneLibraryAsset, motion: XrSceneAnimation) => {
    const result = runControl({ action: 'place', assetId: asset.id, label: nextLabel, motion })
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

  const setSubjectMotion = React.useCallback((subjectId: string, motion: XrSceneAnimation) => {
    runControl({ action: 'animate', subjectId, motion })
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
          <output className={cn('shrink-0 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{runtime.plan.subjects.length} placed</output>
        </section>
        {!sceneReady ? <p className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">Open or create a graph document to place and persist XR scene media.</p> : null}
        <label className="grid gap-1 text-[10px]">
          <span className={UI_THEME_TOKENS.text.tertiary}>Label next subject</span>
          <PanelTextInput value={nextLabel} maxLength={80} placeholder="Optional subject label, e.g. THIEF" onChange={event => setNextLabel(event.target.value)} data-kg-media-xr-next-label="1" />
        </label>
      </header>

      <section className="grid gap-2" aria-label="XR environment kits" data-kg-media-xr-environments="1">
        <header className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-semibold uppercase">Environment Kits</h3><output className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{visibleEnvironments.length}</output></header>
        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleEnvironments.map(stage => (
            <article key={stage.id} className={cn('grid gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, runtime.plan.stageId === stage.id ? UI_THEME_TOKENS.button.activeBg : UI_THEME_TOKENS.panel.bg)} data-kg-media-xr-environment={stage.id}>
              <section className="flex min-w-0 items-start gap-2"><XrCatalogThumb Icon={stage.id === 'aerial-sky' ? TreePine : Building2} color={stage.id === runtime.plan.stageId ? '#38bdf8' : '#94a3b8'} /><section className="min-w-0"><h4 className="text-[11px] font-semibold">{stage.label}</h4><p className={cn('line-clamp-3 text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{stage.description}</p></section></section>
              <footer className="flex min-w-0 items-center justify-between gap-2"><span className={cn('text-[9px]', UI_THEME_TOKENS.text.tertiary)}>{stage.sizeMeters.join(' × ')} m</span><XrInvocationButton invocation={buildXrStageInvocation(stage.id)} disabled={!sceneReady} onInvoke={() => selectEnvironment(stage.id)} /></footer>
            </article>
          ))}
        </section>
      </section>

      <section className="grid gap-2" aria-label="XR subject library" data-kg-media-xr-subject-library="1">
        <header className="grid gap-2"><section className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-semibold uppercase">Subjects &amp; Props</h3><output className={cn('text-[10px]', UI_THEME_TOKENS.text.tertiary)}>{visibleAssets.length}</output></section>
          <nav className="flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="XR library categories">
            {(['all', 'people', 'animals', 'vehicles', 'furniture', 'props'] as const).map(category => {
              const Icon = category === 'all' ? UsersRound : CATEGORY_ICONS[category]
              const label = category === 'all' ? 'All' : XR_SCENE_LIBRARY_CATEGORY_LABELS[category]
              return <button key={category} type="button" className={cn('App-toolbar__btn inline-flex shrink-0 items-center gap-1', categoryFilter === category ? UI_THEME_TOKENS.button.activeBg : '')} aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)} data-kg-media-xr-category={category}><Icon className="size-3" aria-hidden />{label}</button>
            })}
          </nav>
        </header>
        <section className="grid gap-1">{visibleAssets.map(asset => <XrAssetRow key={asset.id} asset={asset} disabled={!sceneReady} motion={assetMotions[asset.id] || 'travel'} onMotionChange={motion => setAssetMotions(current => ({ ...current, [asset.id]: motion }))} onPlace={placeAsset} />)}</section>
      </section>

      {runtime.plan.subjects.length ? (
        <section className="grid gap-2" aria-label="Placed XR subjects" data-kg-media-xr-placed-subjects="1">
          <h3 className="text-[11px] font-semibold uppercase">Placed Subjects</h3>
          {runtime.plan.subjects.map(subject => (
            <article key={subject.id} className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded border p-2', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg)} data-kg-media-xr-placed-subject={subject.id}>
              <XrCatalogThumb Icon={CATEGORY_ICONS[subject.category]} color={subject.color} />
              <label className="grid min-w-0 gap-0.5 text-[10px]"><span className={UI_THEME_TOKENS.text.tertiary}>{subject.assetId}</span><PanelTextInput value={subjectLabelDrafts[subject.id] ?? subject.label} maxLength={80} onChange={event => setSubjectLabelDrafts(current => ({ ...current, [subject.id]: event.target.value }))} onBlur={() => commitSubjectLabel(subject.id)} aria-label={`Label ${subject.label}`} data-kg-media-xr-subject-label={subject.id} /></label>
              {runtime.plan.cast.some(track => track.actorId === subject.id) ? <PanelSelect className="w-20 text-[10px]" aria-label={`Animation for ${subject.label}`} value={runtime.plan.cast.find(track => track.actorId === subject.id)?.marks[0]?.transition === 'hold' ? 'hold' : 'travel'} onChange={event => setSubjectMotion(subject.id, event.target.value as XrSceneAnimation)} data-kg-media-xr-subject-motion={subject.id}><option value="travel">Travel</option><option value="hold">Hold</option></PanelSelect> : <span className={cn('text-[9px]', UI_THEME_TOKENS.text.tertiary)}>Static</span>}
              <button type="button" className="App-toolbar__btn" aria-label={`Remove ${subject.label}`} title={`Remove ${subject.label}`} onClick={() => removeSubject(subject.id)} data-kg-media-xr-remove-subject={subject.id}><Trash2 className="size-3.5" aria-hidden /></button>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  )
}
