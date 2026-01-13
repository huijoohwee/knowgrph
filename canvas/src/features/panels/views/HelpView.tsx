import React from 'react';
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight';
import MainPanelBody from '@/features/panels/ui/MainPanelBody';
import MainPanelHelpHeader from '@/features/panels/ui/MainPanelHelpHeader';
import { HELP_SHORTCUT_ITEMS, type HelpStepKey } from '@/features/panels/config';
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect';
import { normalized as normalizeText } from '@/features/panels/utils/json';
import { HelpSections } from '@/features/panels/views/HelpSections';
import {
  getOrchestratorSectionMarkdownTable,
  getRenderSectionDiagnostics,
  UI_ANCHORS,
  UI_COPY,
} from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

interface HelpViewProps {
  searchQuery: string;
}

export default function HelpView({ searchQuery }: HelpViewProps) {
  const items = HELP_SHORTCUT_ITEMS;

  const normalizedQuery = normalizeText(searchQuery).trim();

  const filteredShortcuts = React.useMemo(
    () =>
      normalizedQuery
        ? items.filter(text => normalizeText(text).includes(normalizedQuery))
        : [...items],
    [items, normalizedQuery],
  );

  const applyShortcutsCopy = React.useCallback(() => {
    try {
      const text = filteredShortcuts.join('\n');
      if (!text) return;
      navigator.clipboard.writeText(text);
    } catch {
      void 0;
    }
  }, [filteredShortcuts]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    try {
      node.scrollTop = 0;
    } catch {
      void 0;
    }
  }, [searchQuery]);

  const launch = useLaunchSpotlight();

  const uiIconScale = useGraphStore(s => s.uiIconScale);
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  );
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );

  const [collapsedBySection, setCollapsedBySection] = React.useState<Record<HelpStepKey, boolean>>({
    shortcuts: true,
    cheatsheet: true,
    panelTour: true,
    workflowLinks: true,
    icons: true,
  });

  const collapseAll = React.useCallback(() => {
    setCollapsedBySection({
      shortcuts: true,
      cheatsheet: true,
      panelTour: true,
      workflowLinks: true,
      icons: true,
    });
  }, []);

  const expandAll = React.useCallback(() => {
    setCollapsedBySection({
      shortcuts: false,
      cheatsheet: false,
      panelTour: false,
      workflowLinks: false,
      icons: false,
    });
  }, []);

  const handleToggleSection = React.useCallback((key: HelpStepKey, next: boolean) => {
    setCollapsedBySection(prev => ({ ...prev, [key]: next }));
  }, []);

  const handleOpenWorkflowTab = React.useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'workflow' } }));
      }
    } catch {
      void 0;
    }
  }, []);

  const handleOpenGraphFieldsTab = React.useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'graphFields' } }));
      }
    } catch {
      void 0;
    }
  }, []);

  const handleOpenSettingsTab = React.useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab: 'settings' } }));
      }
    } catch {
      void 0;
    }
  }, []);

  const allSectionsCollapsed = Object.values(collapsedBySection).every(Boolean);

  const scrollToAnchor = React.useCallback((anchorId: string) => {
    try {
      const container = scrollRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(`[data-kg-anchor="${anchorId}"]`);
      if (!target) return;
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      void 0;
    }
  }, []);

  React.useEffect(() => {
    try {
      const handler = (ev: Event) => {
        const e = ev as CustomEvent<{ anchor?: string } | undefined>;
        const anchor = e.detail && e.detail.anchor;
        if (!anchor) return;
        scrollToAnchor(anchor);
      };
      window.addEventListener('kg:helpScrollToAnchor', handler as EventListener);
      return () => {
        window.removeEventListener('kg:helpScrollToAnchor', handler as EventListener);
      };
    } catch {
      void 0;
    }
  }, [scrollToAnchor]);

  const header = (
    <MainPanelHelpHeader
      allSectionsCollapsed={allSectionsCollapsed}
      onCollapseAll={collapseAll}
      onExpandAll={expandAll}
    />
  );

  return (
    <MainPanelBody header={header} scrollRef={scrollRef}>
      <div
        className={
          [
            'min-h-0 flex flex-col py-2 text-gray-600',
            uiPanelKeyValueTextSizeClass,
            uiPanelTextFontClass,
          ].join(' ')
        }
      >
        <HelpSections
          collapsedBySection={collapsedBySection}
          onToggleSection={handleToggleSection}
          shortcuts={filteredShortcuts}
          onCopyAllShortcuts={applyShortcutsCopy}
          onLaunchSpotlight={launch}
          onOpenWorkflowTab={handleOpenWorkflowTab}
          onOpenGraphFieldsTab={handleOpenGraphFieldsTab}
          onOpenSettingsTab={handleOpenSettingsTab}
        />
        {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
          <div className="mt-4 border-t border-gray-200 pt-2 space-y-3">
            <div>
              <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.tertiary} mb-1`}>
                Dev: LS key mappings
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <div className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>
                    Orchestrator sections (Markdown)
                  </div>
                  <pre className={`text-xs ${UI_THEME_TOKENS.panel.headerBg} border ${UI_THEME_TOKENS.panel.border} rounded p-2 overflow-auto max-h-48 ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary}`}>
                    {getOrchestratorSectionMarkdownTable()}
                  </pre>
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`text-xs font-medium ${UI_THEME_TOKENS.text.secondary}`}>
                    Render sections (diagnostics)
                  </div>
                  <pre className={`text-xs ${UI_THEME_TOKENS.panel.headerBg} border ${UI_THEME_TOKENS.panel.border} rounded p-2 overflow-auto max-h-48 ${uiPanelMonospaceTextClass} ${UI_THEME_TOKENS.text.primary}`}>
                    {JSON.stringify(getRenderSectionDiagnostics(), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div>
              <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.tertiary} mb-1`}>
                Dev: uiIconScale preview
              </div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
                  onClick={handleOpenSettingsTab}
                  data-kg-anchor={UI_ANCHORS.settingsUiIconScale}
                >
                  {UI_COPY.openSettingsUiDensityIconsButtonCompact}
                </button>
                <span className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
                  Current: {uiIconScale}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">
                Semantic layer derivation (cosine / PMI, top‑K, communities)
              </div>
              <div className="text-[11px] text-gray-600 leading-snug space-y-1">
                <p>
                  Semantic layer mode builds a weighted similarity graph from tokenized node text using either cosine similarity or pointwise mutual information (PMI). Tokens are lower‑cased, filtered by length and stopwords, and counted per node; these counts form vectors with Euclidean norms.
                </p>
                <p>
                  The implementation constructs an inverted index from token to (node, count), accumulates dot products and shared token counts for node pairs, and then computes similarity scores: cosine divides the dot product by the product of norms, while PMI applies log₂(pᵢⱼ / (pᵢ · pⱼ)) and clamps negative values.
                </p>
                <p>
                  For each node, neighbor candidates are sorted by similarity; up to top‑K neighbors above the global similarity threshold are kept, and undirected pairs are stored symmetrically. Derived edges receive similarity‑based weights and co‑occurrence‑based widths so renderers can map weight to thickness and count to width.
                </p>
                <p>
                  A Louvain‑style pass assigns communities over this similarity graph by moving nodes between communities when modularity gain is positive at a configurable resolution. Node importance is derived from token counts or incident similarity weights, mapped into a clamped radius band, and stored as visual:importance and visual:nodeSize alongside visual:community and a deterministic community color.
                </p>
                <p>
                  Semantic layer knobs in Settings and the AI‑KG Layers section expose `schema.layers.semantic.similarityEdgeLabel`, `similarityMetric`, `topKEdgesPerNode`, and `minSimilarity`: the label chooses which derived edges count as semantic similarity edges, the metric switches between cosine and PMI, `topKEdgesPerNode` controls per‑node sparsity (defaults to 3, minimum 0), and `minSimilarity` sets a non‑negative threshold where higher values prune weaker edges and emphasize tighter communities. The AI‑KG Layers semantic controls reuse Role → Actions → Outcome tooltips backed by `rag:RoleActionOutcome` fixtures in `schema-config/knowgrph-universal-schema-config.jsonld` so Help copy, Renderer settings, and AgenticRAG JSON‑LD stay aligned.
                </p>
              </div>
            </div>
            <div>
              <div className={`text-xs font-semibold ${UI_THEME_TOKENS.text.tertiary} mb-1`}>
                Layer order and graph layers (semantic → document‑structure → property: “Similarity clusters (semantic)” → “Layered structure (document)” → “Raw data (schema)”)
              </div>
              <div className={`text-[11px] ${UI_THEME_TOKENS.text.secondary} leading-snug space-y-1`}>
                <p>
                  The Graph Layer tab controls the same schema.layers.mode cycle (semantic → document‑structure → property) and drives how a single GraphData snapshot is filtered and decorated for rendering. Semantic is the default and adds similarity edges, Louvain communities, and importance‑based node sizing on top of the imported graph without mutating the source JSON‑LD.
                </p>
                <p>
                  Document‑structure mode keeps all nodes and edges visible but assigns a `visual:layer` to structural block types such as Document, Section, Paragraph, List, ListItem, CodeBlock, and Table so 2D/3D renderers can apply per‑layer opacity while preserving the original layout. Property mode leaves nodes and edges unchanged and derives groups only from array‑valued properties (for example owner→items lists) without semantic overlays.
                </p>
                <p>
                  When Graph Layers are enabled from the Graph Layer view, semantic mode uses `visual:community` and `visual:fill` from the similarity graph to draw convex hull overlays around community clusters so regions approximate semantic neighborhoods rather than raw layout. Document‑structure and property modes continue to respect the same underlying node positions but graph layer overlays fall back to array‑based membership, keeping hulls tightly aligned with the active layer semantics.
                </p>
                <p>
                  The Graph Layer view also exposes a small “Lifecycle tags for layers” helper that writes lifecycle tags such as idea, hypothesis, execution, pivot, and alert into the selected owner node&apos;s properties.tags so graph layer hull colors and node palette colors stay aligned with the renderer lifecycle legend.
                </p>
                <p>
                  The top‑bar Graph Layer button (Shapes icon) is a view‑only toggle for graph layer hull overlays on the canvas; it flips the same graphLayersVisible flag without changing schema.layers.mode or opening the Graph Layer panel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainPanelBody>
  );
}
