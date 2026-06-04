import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import BehaviorSection from '@/features/schema-editor/BehaviorSection'
import LayoutAndRoutingSection from '@/features/schema-editor/LayoutAndRoutingSection'
import SerializationSection from '@/features/schema-editor/SerializationSection'
import RulesAndQualitySection from '@/features/schema-editor/RulesAndQualitySection'
import { useSchemaEditorUiClasses } from '@/features/schema-editor/useSchemaEditorUiClasses'

interface AdvancedSectionProps {
  uniqueNodeTypes: string[]
}
function AdvancedSection({
  uniqueNodeTypes,
}: AdvancedSectionProps) {
  const { schema, setSchema, setBehavior, setCharge, setAlphaDecay, setSerialization, setLodHideLabelsBelow, setHighContrast, setThreeConfig } = useGraphStore()
  const {
    uiPanelKeyValueInputClass,
    uiPanelMonospaceTextClass,
    uiPanelKeyValueTextSizeClass,
    uiPanelMicroLabelTextSizeClass,
  } = useSchemaEditorUiClasses()

  return (
    <section className="space-y-4">
      <BehaviorSection
        schema={schema}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        uniqueNodeTypes={uniqueNodeTypes}
        setBehavior={setBehavior}
      />

      <LayoutAndRoutingSection
        schema={schema}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        setSchema={setSchema}
        setCharge={setCharge}
        setAlphaDecay={setAlphaDecay}
        setThreeConfig={setThreeConfig}
      />

      <SerializationSection
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
        uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
        setSerialization={setSerialization}
      />

      <RulesAndQualitySection
        schema={schema}
        uiPanelKeyValueInputClass={uiPanelKeyValueInputClass}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        setLodHideLabelsBelow={setLodHideLabelsBelow}
        setHighContrast={setHighContrast}
      />
    </section>
  )
}

export default React.memo(AdvancedSection)
