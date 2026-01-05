import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import {
  SCHEMA_STEP_COPY,
  getSchemaSidebarItems,
  type SchemaSectionCopy,
  type SchemaSidebarItem,
} from '@/features/panels/config'

interface SchemaTabContentProps {
  schemaError: string
  step31Collapsed: boolean
  step32Collapsed: boolean
  step33Collapsed: boolean
  onToggleStep31: (next: boolean) => void
  onToggleStep32: (next: boolean) => void
  onToggleStep33: (next: boolean) => void
  step332Collapsed: boolean
  onToggleStep332: (next: boolean) => void
}

function SchemaTabContent({
  schemaError,
  step31Collapsed,
  step32Collapsed,
  step33Collapsed,
  onToggleStep31,
  onToggleStep32,
  onToggleStep33,
  step332Collapsed,
  onToggleStep332,
}: SchemaTabContentProps) {
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const schemaSidebarItems = getSchemaSidebarItems()
  const step321 = SCHEMA_STEP_COPY['3.2.1']
  const step331 = SCHEMA_STEP_COPY['3.3.1']
  const step311 = SCHEMA_STEP_COPY['3.1.1']
  const step332 = SCHEMA_STEP_COPY['3.3.2']

  const getStepTitle = (step: SchemaSectionCopy, opts?: { showDescription?: boolean }) => (
    <div className="flex flex-col">
      <span className="text-xs font-semibold text-gray-800">
        {step.title}
      </span>
      {(opts?.showDescription ?? true) && step.descriptionShort && (
        <span className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
          {step.descriptionShort}
        </span>
      )}
    </div>
  )

  const collapsedBySectionId: Record<SchemaSidebarItem['sectionId'], boolean> = {
    schemaApplyPresets: step31Collapsed,
    schemaTuneRules: step32Collapsed,
    schemaCustomizeUi: step33Collapsed,
    schemaValidationRules: step332Collapsed,
  }

  const toggleBySectionId: Record<SchemaSidebarItem['sectionId'], (next: boolean) => void> = {
    schemaApplyPresets: onToggleStep31,
    schemaTuneRules: onToggleStep32,
    schemaCustomizeUi: onToggleStep33,
    schemaValidationRules: onToggleStep332,
  }

  const renderSectionBody = (item: SchemaSidebarItem) => {
    if (item.sectionId === 'schemaApplyPresets') {
      return (
        <div className="mt-1 space-y-1">
          <div className="text-xs font-semibold text-gray-800">
            {step311.title}
          </div>
          {step311.descriptionShort && (
            <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {step311.descriptionShort}
            </div>
          )}
          {schemaError && (
            <div className={`${uiPanelMicroLabelTextSizeClass} text-red-600 shrink-0 mt-1`}>
              {schemaError}
            </div>
          )}
        </div>
      )
    }

    if (item.sectionId === 'schemaTuneRules') {
      return (
        <div className="mt-1 space-y-1">
          <div className="text-xs font-semibold text-gray-800">
            {step321.title}
          </div>
          {step321.descriptionShort && (
            <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {step321.descriptionShort}
            </div>
          )}
        </div>
      )
    }

    if (item.sectionId === 'schemaCustomizeUi') {
      return (
        <div className="mt-1 space-y-1">
          <div className="text-xs text-gray-700 font-semibold">
            {step331.title}
          </div>
          {step331.descriptionShort && (
            <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {step331.descriptionShort}
            </div>
          )}
        </div>
      )
    }

    if (item.sectionId === 'schemaValidationRules') {
      return (
        <div className="mt-1 space-y-1">
          <div className="text-xs text-gray-700 font-semibold">
            {step332.title}
          </div>
          {step332.descriptionShort && (
            <div className={`${uiPanelMicroLabelTextSizeClass} text-gray-600`}>
              {step332.descriptionShort}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-3">
      {schemaSidebarItems.map(item => {
        const collapsed = collapsedBySectionId[item.sectionId]
        const onToggle = toggleBySectionId[item.sectionId]
        const showDescription = item.sectionId !== 'schemaTuneRules'
        const title = getStepTitle(item, { showDescription })
        const body = renderSectionBody(item)

        if (!body) return null

        return (
          <CollapsibleSection
            key={item.sectionId}
            title={title}
            collapsed={collapsed}
            onToggle={onToggle}
            headerClassName="px-0"
          >
            {body}
          </CollapsibleSection>
        )
      })}
    </div>
  )
}

export { SchemaTabContent, type SchemaTabContentProps }
