import React from 'react';
import type { HelpStepKey } from '@/features/panels/config';
import { HelpCheatsheetSection } from './HelpCheatsheetSection';
import { HelpIconsSection } from './HelpIconsSection';
import { HelpPanelTourSection } from './HelpPanelTourSection';
import { HelpShortcutsSection } from './HelpShortcutsSection';
import { HelpWorkflowLinksSection } from './HelpWorkflowLinksSection';

interface HelpSectionsProps {
  collapsedBySection: Record<HelpStepKey, boolean>;
  onToggleSection: (key: HelpStepKey, next: boolean) => void;
  searchQuery: string;
  shortcuts: string[];
  onCopyAllShortcuts: () => void;
  onLaunchSpotlight: () => void;
  onOpenWorkflowTab: () => void;
  onOpenGraphFieldsTab: () => void;
  onOpenSettingsTab: () => void;
}

export function HelpSections({
  collapsedBySection,
  onToggleSection,
  searchQuery,
  shortcuts,
  onCopyAllShortcuts,
  onLaunchSpotlight,
  onOpenWorkflowTab,
  onOpenGraphFieldsTab,
  onOpenSettingsTab,
}: HelpSectionsProps) {
  return (
    <section className="mt-3" aria-label="Help sections">
      <HelpShortcutsSection
        collapsed={collapsedBySection.shortcuts}
        onToggle={next => onToggleSection('shortcuts', next)}
        searchQuery={searchQuery}
        shortcuts={shortcuts}
        onCopyAllShortcuts={onCopyAllShortcuts}
        onLaunchSpotlight={onLaunchSpotlight}
      />
      <HelpCheatsheetSection
        collapsed={collapsedBySection.cheatsheet}
        onToggle={next => onToggleSection('cheatsheet', next)}
      />
      <HelpPanelTourSection
        collapsed={collapsedBySection.panelTour}
        onToggle={next => onToggleSection('panelTour', next)}
      />
      <HelpWorkflowLinksSection
        collapsed={collapsedBySection.workflowLinks}
        onToggle={next => onToggleSection('workflowLinks', next)}
        onOpenWorkflowTab={onOpenWorkflowTab}
        onOpenGraphFieldsTab={onOpenGraphFieldsTab}
      />
      <HelpIconsSection
        collapsed={collapsedBySection.icons}
        onToggle={next => onToggleSection('icons', next)}
        onOpenSettingsTab={onOpenSettingsTab}
      />
    </section>
  );
}
