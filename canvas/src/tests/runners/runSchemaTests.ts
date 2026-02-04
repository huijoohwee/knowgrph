import { execTest, TestResult } from './testRunnerUtils'
import {
  testValidateSchemaFillsDefaults,
  testValidateSchemaBehaviorDefaults,
  testAddRenameRemoveNodeType,
  testUpsertRemoveNodeProperty,
  testClampAlphaDecay,
  testSchemaTabEnterText,
  testSchemaPersistenceWrites,
  testResetImportSchemaTabTextSync,
  testResetImportSchemaTabApplyModifiedSync,
  testSchemaUiApplyUsesLatestStoreSchema,
  testSchemaUiApplyRegistrationGuardsAgainstImportRace,
  testParseSchemaTextRejectsInvalidJson,
  testClampCollisionRadiusUsesSharedBounds,
  testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance,
} from '@/__tests__/schema.test'
import {
  testLayoutPositioningCacheKeyUsesRenderVariant,
  testLayoutPositioningForcesLayoutWhenVariantChanges,
  testLayoutPositioningSkipsReseedOnToggle,
} from '@/__tests__/layoutPositioning.test'

export const runSchemaTests = async (results: TestResult[]) => {
  await execTest(results, 'schema.validateDefaults', testValidateSchemaFillsDefaults)
  await execTest(results, 'schema.behaviorDefaults', testValidateSchemaBehaviorDefaults)
  await execTest(results, 'schema.typeCRUD', testAddRenameRemoveNodeType)
  await execTest(results, 'schema.nodePropertyCRUD', testUpsertRemoveNodeProperty)
  await execTest(results, 'schema.alphaDecayClamp', testClampAlphaDecay)
  await execTest(results, 'schema.collisionRadiusClamp', testClampCollisionRadiusUsesSharedBounds)
  await execTest(results, 'schema.semanticNodeRadiusUsesProps', testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance)
  await execTest(results, 'layout.positioning.cacheKeyAndSkip', testLayoutPositioningSkipsReseedOnToggle)
  await execTest(results, 'layout.positioning.cacheKeyUsesRenderVariant', testLayoutPositioningCacheKeyUsesRenderVariant)
  await execTest(results, 'layout.positioning.variantChangeForcesLayout', testLayoutPositioningForcesLayoutWhenVariantChanges)
  await execTest(results, 'schema.tabEnterText', testSchemaTabEnterText)
  await execTest(results, 'schema.persistenceWrites', testSchemaPersistenceWrites)
  await execTest(results, 'schema.resetImportTextSync', testResetImportSchemaTabTextSync)
  await execTest(results, 'schema.resetImportApplyModifiedTextSync', testResetImportSchemaTabApplyModifiedSync)
  await execTest(results, 'schema.uiApplyUsesLatestStoreSchema', testSchemaUiApplyUsesLatestStoreSchema)
  await execTest(
    results,
    'schema.uiApplyRegistrationGuardsAgainstImportRace',
    testSchemaUiApplyRegistrationGuardsAgainstImportRace,
  )
  await execTest(results, 'schema.parseSchemaTextRejectsInvalidJson', testParseSchemaTextRejectsInvalidJson)
}
