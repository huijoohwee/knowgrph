import { collectRepoLevelHardcodedMotionRecipeOffenders } from '@/__tests__/helpers/motionTokenAudit'

export function testMotionTokenSsoTAuditFindsNoOtherRepoLevelCssMotionRecipes() {
  const offenders = collectRepoLevelHardcodedMotionRecipeOffenders()
  if (offenders.length > 0) {
    throw new Error(`expected no other repo-level CSS surfaces to keep hardcoded 140ms ease motion recipes, found: ${offenders.join(', ')}`)
  }
}
