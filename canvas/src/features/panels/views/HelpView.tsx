import React from 'react';
import { useHelpViewLogic } from '@/features/panels/hooks/useHelpViewLogic';
import MainPanelBody from '@/features/panels/ui/MainPanelBody';
import MainPanelHelpHeader from '@/features/panels/ui/MainPanelHelpHeader';
import { HelpSections } from '@/features/panels/views/HelpSections';
import {
  loadMainPanelHelpDevTexts,
  type MainPanelHelpDevText,
} from '@/features/panels/mainPanelHelpDev';
import {
  UI_ANCHORS,
  UI_COPY,
} from '@/lib/config';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';
import {
  HelpKtvActionGroup,
  HelpKtvMutedText,
  HelpKtvRow,
  HelpKtvRows,
  HelpKtvValueStack,
} from './HelpKtvLayout';

interface HelpViewProps {
  searchQuery: string;
}

const EMPTY_HELP_DEV_TEXT: MainPanelHelpDevText = {
  key: '',
  value: '',
  details: [],
};

export default function HelpView({ searchQuery }: HelpViewProps) {
  const {
    filteredShortcuts,
    threeKeyboardShortcuts,
    applyShortcutsCopy,
    scrollRef,
    launch,
    uiIconScale,
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    collapsedBySection,
    collapseAll,
    expandAll,
    handleToggleSection,
    allSectionsCollapsed,
    handleOpenStoryboardWidgetManagerTab,
    handleOpenSettingsTab,
  } = useHelpViewLogic({ searchQuery });
  const [helpDevTextByKey, setHelpDevTextByKey] = React.useState<Record<string, MainPanelHelpDevText>>({});

  React.useEffect(() => {
    let alive = true;
    loadMainPanelHelpDevTexts().then(rows => {
      if (!alive) return;
      setHelpDevTextByKey(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const getHelpDevText = React.useCallback(
    (key: string): MainPanelHelpDevText => helpDevTextByKey[key] || EMPTY_HELP_DEV_TEXT,
    [helpDevTextByKey],
  );
  const devDiagnosticsText = getHelpDevText('dev.lsKeyMappings');
  const iconScalePreviewText = getHelpDevText('dev.uiIconScalePreview');
  const semanticLayerText = getHelpDevText('semantic.layerDerivation');

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
          searchQuery={searchQuery}
          shortcuts={filteredShortcuts}
          threeKeyboardShortcuts={threeKeyboardShortcuts}
          onCopyAllShortcuts={applyShortcutsCopy}
          onLaunchSpotlight={launch}
          onOpenStoryboardWidgetManagerTab={handleOpenStoryboardWidgetManagerTab}
          onOpenSettingsTab={handleOpenSettingsTab}
        />
        {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && (
          <section className="mt-2">
            <HelpKtvRows aria-label="Help dev rows">
              <HelpKtvRow
                keyNode="Dev Diagnostics"
                iconKey="ktv.type.static"
                valueNode={(
                  <HelpKtvValueStack>
                    {devDiagnosticsText.value ? <HelpKtvMutedText>{devDiagnosticsText.value}</HelpKtvMutedText> : null}
                  </HelpKtvValueStack>
                )}
              />
              <HelpKtvRow
                keyNode="Icon Scale"
                iconKey="mainPanel.settings"
                valueNode={(
                  <HelpKtvValueStack>
                    <HelpKtvActionGroup>
                      <button
                        type="button"
                        className={`App-toolbar__btn ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.panel.headerBg} ${UI_THEME_TOKENS.text.secondary}`}
                        onClick={handleOpenSettingsTab}
                        data-kg-anchor={UI_ANCHORS.settingsUiIconScale}
                      >
                        {UI_COPY.openSettingsUiDensityIconsButtonCompact}
                      </button>
                    </HelpKtvActionGroup>
                    <HelpKtvMutedText>
                      {iconScalePreviewText.value || 'Icon scale preview'}
                      {`: ${uiIconScale}`}
                    </HelpKtvMutedText>
                  </HelpKtvValueStack>
                )}
              />
              <HelpKtvRow
                keyNode="Semantic Layer"
                iconKey="ktv.type.static"
                valueNode={(
                  <HelpKtvValueStack>
                    {semanticLayerText.value ? <HelpKtvMutedText>{semanticLayerText.value}</HelpKtvMutedText> : null}
                  </HelpKtvValueStack>
                )}
              />
            </HelpKtvRows>
          </section>
        )}
      </article>
    </MainPanelBody>
  );
}
