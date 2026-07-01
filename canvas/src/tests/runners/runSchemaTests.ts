import { execTest, TestResult } from './testRunnerUtils'

const modSchema = () => import('@/__tests__/schema.test')
const modLayoutPositioning = () => import('@/__tests__/layoutPositioning.test')
const modLayoutDatasetKeyStable = () => import('@/__tests__/layoutDatasetKeyStable.test')
const modCanvas3dMode = () => import('@/__tests__/canvas3dMode.test')
const modCanvasXrSessionPolicy = () => import('@/__tests__/canvasXrSessionPolicy.test')
const modCanvasXrPhysicsPlayground = () => import('@/__tests__/canvasXrPhysicsPlayground.test')
const modVideoSequenceTimelinePreset = () => import('@/__tests__/videoSequenceTimelinePreset.test')
const modCanvasViewDisplayControls = () => import('@/__tests__/canvasViewDisplayControls.test')
const modXrAssetConversion = () => import('@/__tests__/xrAssetConversionHarness.test')
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
  await execTest(results, 'canvas.viewSelection.xrSurfaceMode', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeNormalizesAndCanvasViewSelectionActivatesSurface()
  })
  await execTest(results, 'canvas.xrMode.nativeSessionPolicy', async () => {
    const mod = await modCanvasXrSessionPolicy()
    await mod.testXrSessionPolicyPrefersNativeArWithoutProviderDependency()
  })
  await execTest(results, 'canvas.xrMode.physicsPlaygroundModel', async () => {
    const mod = await modCanvasXrPhysicsPlayground()
    await mod.testXrPhysicsPlaygroundUsesNativeBoundedInteractionModel()
  })
  await execTest(results, 'canvas.viewSelection.shared3dSurfaceModeOwner', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasSurfaceMode3dSelectionUsesSharedOwner()
  })
  await execTest(results, 'canvas.renderSettings.xrModeSelect', async () => {
    const mod = await modCanvas3dMode()
    await mod.testRenderSettings3dModeSelectPreservesXrMode()
  })
  await execTest(results, 'canvas.frontmatter.videoSequenceTimelineFlowEditorPreset', async () => {
    const mod = await modVideoSequenceTimelinePreset()
    await mod.testVideoSequenceTimelinePresetRespectsExplicitFlowEditorRenderer()
  })
  await execTest(results, 'canvas.viewDisplayControls.gridSnap.all2dRenderers', async () => {
    const mod = await modCanvasViewDisplayControls()
    await mod.testAll2dRenderersExposeSharedGridSnapDisplayControls()
  })
  await execTest(results, 'canvas.xrMode.glbAssetRenderGate', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeRendersGlbAssetDocumentsWithoutWebxrSessionGate()
  })
  await execTest(results, 'canvas.xrMode.graphSpatialStage', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeGraphSceneUsesDistinctSpatialStageInsteadOfPlain3dGlobe()
  })
  await execTest(results, 'canvas.xrMode.gltfAssetRenderGate', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeRendersGltfAssetDocumentsWithoutWebxrSessionGate()
  })
  await execTest(results, 'canvas.xrMode.flatModelFacingStability', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModePreservesFlatModelFacingInsteadOfAutoRotatingAway()
  })
  await execTest(results, 'canvas.xrMode.modelAssetDocumentScopedRenderIdentity', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeModelAssetSwitchUsesDocumentScopedRenderIdentity()
  })
  await execTest(results, 'canvas.xrMode.modelAssetCameraXyzReset', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeModelAssetSwitchResetsCameraXyzCoordinates()
  })
  await execTest(results, 'canvas.xrMode.gltfIngestParseRenderPipeline', async () => {
    const mod = await modCanvas3dMode()
    await mod.testXrModeGltfIngestParseRenderPipelineUsesNeutralPayload()
  })
  await execTest(results, 'canvas.xrAsset.pngToSvgHarness.vtracerZeroToken', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrPngToSvgHarnessUsesVTracerAndZeroTokenCost()
  })
  await execTest(results, 'canvas.xrAsset.pngToSvgHarness.inputFallbacks', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrPngToSvgHarnessFallsBackBeforeToolExecution()
  })
  await execTest(results, 'canvas.xrAsset.pngToSvgHarness.pathBudget', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrPngToSvgHarnessFallsBackForPathBudget()
  })
  await execTest(results, 'canvas.xrAsset.pngTextureFidelity.glbAndGltf', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrPngToGlbAndGltfEmbedSourceTextureFidelity()
  })
  await execTest(results, 'canvas.xrAsset.generatedImageModel.centeredXyzCoordinates', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrGeneratedImageModelUsesCenteredXyzCoordinates()
  })
  await execTest(results, 'canvas.xrAsset.svgToGlbCompiler.unsafeSvgGuard', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrSvgToGlbCompilerRejectsUnsafeSvg()
  })
  await execTest(results, 'canvas.xrAsset.svgToGlbCompiler.manifestInspect', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrSvgToGlbCompilerProducesValidXrManifest()
  })
  await execTest(results, 'workspace.import.xrImage.localSvgToGlbAndGltf', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrImageLocalSvgImportCreatesSourceFilesAndModelArtifacts()
  })
  await execTest(results, 'workspace.import.xrImage.urlPngToGlbAndGltf', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrImageUrlPngImportCreatesSourceFilesAndModelArtifacts()
  })
  await execTest(results, 'workspace.import.xrImage.absoluteUrlPngFilename', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrImageUrlAbsolutePngImportPreservesLocalFilename()
  })
  await execTest(results, 'workspace.import.xrImage.absoluteUrlPngUnicodeFilename', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrImageUrlAbsolutePngImportPreservesUnicodeFilename()
  })
  await execTest(results, 'workspace.import.xrImage.githubBlobPngFilename', async () => {
    const mod = await modXrAssetConversion()
    await mod.testXrImageUrlGithubBlobPngImportNormalizesAndPreservesFilename()
  })
  await execTest(results, 'canvas.viewSelection.voxelGeospatialGuard', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewSelectionBlocksVoxelDuringGeospatialMode()
  })
  await execTest(results, 'canvas.viewSelection.rendererOptionsStaySelectable', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewRendererOptionsStaySelectableAcrossInactiveVoxelState()
  })
  await execTest(results, 'canvas.viewSelection.mobileFirstGroupedOrder', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewMenuKeepsMobileFirstGroupedOrder()
  })
  await execTest(results, 'canvas.viewSelection.timelineDisplayControl', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewTimelineToggleUsesSharedViewModeOption()
  })
  await execTest(results, 'canvas.viewSelection.minimapDisplayControl', async () => {
    const mod = await modCanvasViewDisplayControls()
    await mod.testCanvasViewMinimapToggleUsesDisplayControlOption()
  })
  await execTest(results, 'canvas.viewSelection.rendererActivates2dSurface', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvasViewRendererSelectionActivates2dSurface()
  })
  await execTest(results, 'canvas.viewSelection.flowEditorLayoutRebalance', async () => {
    const mod = await modCanvas3dMode()
    await mod.testFlowEditorLayoutMenuRequestsBalancedRebalance()
  })
  await execTest(results, 'canvas.3dMode.persistedGeospatialGuard', async () => {
    const mod = await modCanvas3dMode()
    await mod.testCanvas3dModeSetterRejectsVoxelWhileGeospatialModeIsPersisted()
  })
  await execTest(results, 'canvas.geospatialPreference.ignoresLegacyUnversionedTrue', async () => {
    const mod = await modCanvas3dMode()
    await mod.testGeospatialOverlayPreferenceIgnoresLegacyUnversionedTrue()
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
  await execTest(results, 'io.pmfVoxel.adapter.reusesSharedPlainObjectGuard', async () => {
    const mod = await modPmfVoxelImport()
    await mod.testGraphIoAdapterReusesSharedPlainObjectGuardForPmfDetection()
  })
  await execTest(results, 'io.pmfVoxel.parser.reusesSharedPlainObjectGuard', async () => {
    const mod = await modPmfVoxelImport()
    await mod.testPmfVoxelParserReusesSharedPlainObjectGuard()
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
