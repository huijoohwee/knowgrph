import { execTest, TestResult } from './testRunnerUtils'

const modSchema = () => import('@/__tests__/schema.test')
const modLayoutPositioning = () => import('@/__tests__/layoutPositioning.test')
const modLayoutDatasetKeyStable = () => import('@/__tests__/layoutDatasetKeyStable.test')
const modCanvas3dMode = () => import('@/__tests__/canvas3dMode.test')
const modPmfVoxelImport = () => import('@/__tests__/pmfVoxelImport.test')
const modPmfVoxelVisibility = () => import('@/__tests__/pmfVoxelVisibility.test')
const modVoxelCameraPose = () => import('@/__tests__/voxelCameraPose.test')

export const runSchemaTests = async (results: TestResult[]) => {
  await execTest(results, 'schema.validateDefaults', async () => {
    const mod = await modSchema()
    await mod.testValidateSchemaFillsDefaults()
  })
  await execTest(results, 'schema.behaviorDefaults', async () => {
    const mod = await modSchema()
    await mod.testValidateSchemaBehaviorDefaults()
  })
  await execTest(results, 'schema.typeCRUD', async () => {
    const mod = await modSchema()
    await mod.testAddRenameRemoveNodeType()
  })
  await execTest(results, 'schema.nodePropertyCRUD', async () => {
    const mod = await modSchema()
    await mod.testUpsertRemoveNodeProperty()
  })
  await execTest(results, 'schema.alphaDecayClamp', async () => {
    const mod = await modSchema()
    await mod.testClampAlphaDecay()
  })
  await execTest(results, 'schema.collisionRadiusClamp', async () => {
    const mod = await modSchema()
    await mod.testClampCollisionRadiusUsesSharedBounds()
  })
  await execTest(results, 'schema.semanticNodeRadiusUsesProps', async () => {
    const mod = await modSchema()
    await mod.testRenderNodeRadiusSemanticRespectsNodeSizeAndImportance()
  })
  await execTest(results, 'layout.positioning.cacheKeyAndSkip', async () => {
    const mod = await modLayoutPositioning()
    await mod.testLayoutPositioningSkipsReseedOnToggle()
  })
  await execTest(results, 'layout.positioning.cacheKeyUsesRenderVariant', async () => {
    const mod = await modLayoutPositioning()
    await mod.testLayoutPositioningCacheKeyUsesRenderVariant()
  })
  await execTest(results, 'layout.positioning.variantChangeForcesLayout', async () => {
    const mod = await modLayoutPositioning()
    await mod.testLayoutPositioningForcesLayoutWhenVariantChanges()
  })
  await execTest(results, 'layout.datasetKey.stableAcrossRevision', async () => {
    const mod = await modLayoutDatasetKeyStable()
    await mod.testLayoutDatasetKeyStableAcrossRevision()
  })
  await execTest(results, 'canvas.3dMode.geospatialGuard', async () => {
    const mod = await modCanvas3dMode()
    await mod.testVoxelModeRejectsGeospatialMode()
  })
  await execTest(results, 'canvas.viewSelection.voxelGeospatialGuard', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewSelectionBlocksVoxelDuringGeospatialMode()
  })
  await execTest(results, 'canvas.3dMode.persistedGeospatialGuard', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvas3dModeSetterRejectsVoxelWhileGeospatialModeIsPersisted()
  })
  await execTest(results, 'schema.tabEnterText', async () => {
    const mod = await modSchema()
    await mod.testSchemaTabEnterText()
  })
  await execTest(results, 'schema.persistenceWrites', async () => {
    const mod = await modSchema()
    await mod.testSchemaPersistenceWrites()
  })
  await execTest(results, 'schema.resetImportTextSync', async () => {
    const mod = await modSchema()
    await mod.testResetImportSchemaTabTextSync()
  })
  await execTest(results, 'schema.resetImportApplyModifiedTextSync', async () => {
    const mod = await modSchema()
    await mod.testResetImportSchemaTabApplyModifiedSync()
  })
  await execTest(results, 'schema.uiApplyUsesLatestStoreSchema', async () => {
    const mod = await modSchema()
    await mod.testSchemaUiApplyUsesLatestStoreSchema()
  })
  await execTest(results, 'schema.uiApplyRegistrationGuardsAgainstImportRace', async () => {
    const mod = await modSchema()
    await mod.testSchemaUiApplyRegistrationGuardsAgainstImportRace()
  })
  await execTest(results, 'schema.parseSchemaTextRejectsInvalidJson', async () => {
    const mod = await modSchema()
    await mod.testParseSchemaTextRejectsInvalidJson()
  })

  await execTest(results, 'io.pmfVoxel.import.siblingRepoOptional', async () => {
    const mod = await modPmfVoxelImport()
    await mod.testPmfVoxelImportFromSiblingRepoIfPresent()
  })
  await execTest(results, 'io.pmfVoxel.resolvers.preferImportedLayerMetadata', async () => {
    const mod = await modPmfVoxelImport()
    await mod.testPmfVoxelResolversPreferImportedLayerMetadata()
  })
  await execTest(results, 'io.pmfVoxel.parseRoute', async () => {
    const mod = await modPmfVoxelVisibility()
    await mod.testPmfJsonRoutesToPmfVoxelParser()
  })
  await execTest(results, 'io.pmfVoxel.multilayerVisibility', async () => {
    const mod = await modPmfVoxelVisibility()
    await mod.testPmfVoxelPositionsUseMultipleLayerHeights()
  })
  await execTest(results, 'three.voxelCamera.defaultConfig', async () => {
    const mod = await modVoxelCameraPose()
    await mod.testVoxelCameraDefaultsAreStable()
  })
  await execTest(results, 'three.voxelCamera.buildIntroPose', async () => {
    const mod = await modVoxelCameraPose()
    await mod.testVoxelCameraBuildsValidIntroPoses()
  })
}
