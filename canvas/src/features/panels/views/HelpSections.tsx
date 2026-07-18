import React from 'react';
import type { HelpStepKey } from '@/features/panels/config';
import {
  KeyTypeValueHeader,
  KeyTypeValueSectionStack,
} from 'grph-shared/react/keyTypeValueLayout';
import { shouldFlushKeyTypeValueSectionTop } from 'grph-shared/ui/keyTypeValueRows';
import { HelpCheatsheetSection } from './HelpCheatsheetSection';
import { HelpCloudflareMediaSection } from './HelpCloudflareMediaSection';
import { HelpCommandMenuSection } from './HelpCommandMenuSection';
import { HelpIconsSection } from './HelpIconsSection';
import { HelpPanelTourSection } from './HelpPanelTourSection';
import { HelpShortcutsSection } from './HelpShortcutsSection';
import { HelpWorkflowLinksSection } from './HelpWorkflowLinksSection';
import type { ThreeKeyboardShortcut } from '@/features/three/threeKeyboardShortcutCatalog';

interface HelpSectionsProps {
  collapsedBySection: Record<HelpStepKey, boolean>;
  onToggleSection: (key: HelpStepKey, next: boolean) => void;
  searchQuery: string;
  shortcuts: string[];
  threeKeyboardShortcuts: readonly ThreeKeyboardShortcut[];
  onCopyAllShortcuts: () => void;
  onLaunchSpotlight: () => void;
  onOpenStoryboardWidgetManagerTab: () => void;
  onOpenSettingsTab: () => void;
}

export function HelpSections({
  collapsedBySection,
  onToggleSection,
  searchQuery,
  shortcuts,
  threeKeyboardShortcuts,
  onCopyAllShortcuts,
  onLaunchSpotlight,
  onOpenStoryboardWidgetManagerTab,
  onOpenSettingsTab,
}: HelpSectionsProps) {
  return (
    <section className="mt-0" aria-label="Help sections">
      <KeyTypeValueHeader />
      <KeyTypeValueSectionStack>
        <HelpShortcutsSection
          collapsed={collapsedBySection.shortcuts}
          onToggle={next => onToggleSection('shortcuts', next)}
          searchQuery={searchQuery}
          shortcuts={shortcuts}
          threeKeyboardShortcuts={threeKeyboardShortcuts}
          onCopyAllShortcuts={onCopyAllShortcuts}
          onLaunchSpotlight={onLaunchSpotlight}
          flushTop={shouldFlushKeyTypeValueSectionTop(0)}
        />
        <HelpCheatsheetSection
          collapsed={collapsedBySection.cheatsheet}
          onToggle={next => onToggleSection('cheatsheet', next)}
        />
        <HelpCommandMenuSection
          collapsed={collapsedBySection.commandMenu}
          onToggle={next => onToggleSection('commandMenu', next)}
        />
        <HelpCloudflareMediaSection
          collapsed={collapsedBySection.cloudflareMedia}
          onToggle={next => onToggleSection('cloudflareMedia', next)}
        />
        <HelpPanelTourSection
          collapsed={collapsedBySection.panelTour}
          onToggle={next => onToggleSection('panelTour', next)}
        />
        <HelpWorkflowLinksSection
          collapsed={collapsedBySection.workflowLinks}
          onToggle={next => onToggleSection('workflowLinks', next)}
          onOpenStoryboardWidgetManagerTab={onOpenStoryboardWidgetManagerTab}
        />
        <HelpIconsSection
          collapsed={collapsedBySection.icons}
          onToggle={next => onToggleSection('icons', next)}
          onOpenSettingsTab={onOpenSettingsTab}
        />
      </KeyTypeValueSectionStack>
    </section>
  );
}
