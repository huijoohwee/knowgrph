import React from 'react';
import { useHelpViewLogic } from '@/features/panels/hooks/useHelpViewLogic';
import MainPanelBody from '@/features/panels/ui/MainPanelBody';
import MainPanelHelpHeader from '@/features/panels/ui/MainPanelHelpHeader';
import { HelpSections } from '@/features/panels/views/HelpSections';
import {
  getOrchestratorSectionMarkdownTable,
  getRenderSectionDiagnostics,
  UI_ANCHORS,
  UI_COPY,
} from '@/lib/config';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

interface HelpViewProps {
  searchQuery: string;
}

export default function HelpView({ searchQuery }: HelpViewProps) {
  const {
    filteredShortcuts,
    applyShortcutsCopy,
    scrollRef,
    launch,
    uiIconScale,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    collapsedBySection,
    collapseAll,
    expandAll,
    handleToggleSection,
    allSectionsCollapsed,
    handleOpenWorkflowTab,
    handleOpenGraphFieldsTab,
    handleOpenSettingsTab,
  } = useHelpViewLogic({ searchQuery });

  const header = (
    <MainPanelHelpHeader
      allSectionsCollapsed={allSectionsCollapsed}
      onCollapseAll={collapseAll}
      onExpandAll={expandAll}
    />
  );

  return (
    <MainPanelBody header={header} scrollRef={scrollRef}>
      <article
        className={
          [
            'min-h-0 flex flex-col py-2',
            UI_THEME_TOKENS.text.secondary,
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
          <section className={`mt-4 border-t ${UI_THEME_TOKENS.panel.border} pt-2 space-y-3`}>
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
                Semantic layer derivation (cosine / PMI, top‑K, clusters)
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
                  A NetworkX connected-components pass assigns clusters over this similarity graph. Node importance is derived from token counts or incident similarity weights, mapped into a clamped radius band, and stored as visual:importance and visual:nodeSize alongside visual:community and a deterministic cluster color.
                </p>
              </div>
            </div>
          </section>
        )}
      </article>
    </MainPanelBody>
  );
}
