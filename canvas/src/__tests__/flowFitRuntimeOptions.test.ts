import { buildFlowFitOptions, FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO } from '@/components/FlowCanvas/fitRuntime'
import { FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX } from '@/components/FlowCanvas/frontmatterLayoutConfig'
import { DEFAULT_FIT_TO_SCREEN_FILL_RATIO } from '@/lib/graph/layoutDefaults'
import { defaultSchema } from '@/lib/graph/schema'

export function testBuildFlowFitOptionsUsesDenserFrontmatterInitialFitFillRatio() {
  const frontmatter = buildFlowFitOptions({
    schema: defaultSchema,
    intent: 'initialFit',
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
  })
  if (frontmatter.targetFillRatio !== FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO) {
    throw new Error(
      `expected frontmatter initial fit to use ${FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO}, got ${String(frontmatter.targetFillRatio)}`,
    )
  }

  const standard = buildFlowFitOptions({
    schema: defaultSchema,
    intent: 'initialFit',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
  })
  if (standard.targetFillRatio !== DEFAULT_FIT_TO_SCREEN_FILL_RATIO) {
    throw new Error(
      `expected non-frontmatter initial fit to keep default fill ratio ${DEFAULT_FIT_TO_SCREEN_FILL_RATIO}, got ${String(standard.targetFillRatio)}`,
    )
  }
}

export function testBuildFlowFitOptionsAllowsFrontmatterInitialFitOverride() {
  const frontmatter = buildFlowFitOptions({
    schema: defaultSchema,
    intent: 'initialFit',
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    frontmatterFlowInitialFitFillRatio: FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX + 1,
  })
  if (frontmatter.targetFillRatio !== FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX) {
    throw new Error(
      `expected frontmatter override to clamp to ${FLOW_FRONTMATTER_INITIAL_FIT_FILL_RATIO_MAX}, got ${String(frontmatter.targetFillRatio)}`,
    )
  }

  const standard = buildFlowFitOptions({
    schema: defaultSchema,
    intent: 'fitToView',
    frontmatterModeEnabled: true,
    multiDimTableModeEnabled: false,
    documentSemanticMode: 'document',
    documentStructureBaselineLock: false,
    frontmatterFlowInitialFitFillRatio: 0.72,
  })
  if (standard.targetFillRatio === 0.72) {
    throw new Error('expected non-initial frontmatter fits to ignore the initial-fit override')
  }
}
