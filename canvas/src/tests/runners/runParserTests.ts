import { execTest, TestResult } from './testRunnerUtils'
import { testParserRegistryCrud } from '@/__tests__/parserRegistry.test'
import { testCustomParserConversion } from '@/__tests__/customParser.test'
import { testCustomParserTransforms } from '@/__tests__/customParserTransforms.test'
import { testTransformArrayPath } from '@/__tests__/transformArrayPath.test'
import { testWildcardAggregation } from '@/__tests__/wildcardAgg.test'
import { testWildcardMinMaxAvg } from '@/__tests__/wildcardMinMaxAvg.test'
import { testWildcardPercentile } from '@/__tests__/wildcardPercentile.test'
import { testWildcardPercentileNearest } from '@/__tests__/wildcardPercentileMethod.test'
import { testWildcardPercentileTukeyHazen } from '@/__tests__/wildcardPercentileTukeyHazen.test'
import { testWildcardPercentileHF } from '@/__tests__/wildcardPercentileHF.test'
import { testCustomParserTypeMethodWarning } from '@/__tests__/customParserWarnings.test'
import { testParserAutoSelectOnLoad } from '@/__tests__/parserAutoApply.test'
import { testParserUIStateHydration } from '@/__tests__/parserUiState.test'
import { testYamlTransformsValidation } from '@/__tests__/yamlTransforms.test'
import { testParserCacheCfgKey } from '@/__tests__/parserCacheCfgKey.test'
import { testParserWorkflowPresetStorage } from '@/__tests__/parserWorkflowPersistence.test'
import {
  testRawJsonNodesArrayIngestion,
  testRawJsonExtendedNodesIngestion,
} from '@/__tests__/rawJsonIngestion.test'
import { testRawJsonWorkflowShapeIngestion } from '@/__tests__/rawJsonWorkflowShapeIngestion.test'
import {
  testMermaidSubgraphParsingAddsParentId,
  testMermaidSubgraphDerivationBuildsGroups,
} from '@/__tests__/mermaidSubgraphGroups.test'
import { testMermaidSeedLayoutSpreadsGroupsAndCenters } from '@/__tests__/mermaidSeedLayout.test'
import {
  testGraphRagTextPipelineBuildsGraphAcrossDomains,
  testGraphRagTextPipelineMatchesDemoFixture,
  testGraphRagTextParserSpecMatchesTxt,
  testGraphRagTextParserSelectionPrefersGraphRagOnPlainMd,
} from '@/__tests__/graphragTextPipeline.test'

export const runParserTests = async (results: TestResult[]) => {
  await execTest(results, 'parser.registryCrud', testParserRegistryCrud)
  await execTest(results, 'parser.customConversion', testCustomParserConversion)
  await execTest(results, 'parser.customTransforms', testCustomParserTransforms)
  await execTest(results, 'parser.arrayPath', testTransformArrayPath)
  await execTest(results, 'parser.wildcardAgg', testWildcardAggregation)
  await execTest(results, 'parser.wildcardMinMaxAvg', testWildcardMinMaxAvg)
  await execTest(results, 'parser.wildcardPercentile', testWildcardPercentile)
  await execTest(results, 'parser.wildcardPercentileNearest', testWildcardPercentileNearest)
  await execTest(results, 'parser.wildcardPercentileTukeyHazen', testWildcardPercentileTukeyHazen)
  await execTest(results, 'parser.wildcardPercentileHF', testWildcardPercentileHF)
  await execTest(results, 'parser.typeMethodWarning', testCustomParserTypeMethodWarning)
  await execTest(results, 'parser.autoSelectOnLoad', testParserAutoSelectOnLoad)
  await execTest(results, 'parser.uiStateHydration', testParserUIStateHydration)
  await execTest(results, 'parser.yamlTransformsValidation', testYamlTransformsValidation)
  await execTest(results, 'parser.cacheCfgKey', testParserCacheCfgKey)
  await execTest(results, 'parser.workflowPresetStorage', testParserWorkflowPresetStorage)
  await execTest(results, 'parser.rawJson.nodesArrayIngestion', testRawJsonNodesArrayIngestion)
  await execTest(results, 'parser.rawJson.extendedNodesIngestion', testRawJsonExtendedNodesIngestion)
  await execTest(results, 'parser.rawJson.workflowShapeIngestion', testRawJsonWorkflowShapeIngestion)
  await execTest(results, 'parser.mermaid.subgraphParentId', testMermaidSubgraphParsingAddsParentId)
  await execTest(results, 'parser.mermaid.subgraphGroupDerivation', testMermaidSubgraphDerivationBuildsGroups)
  await execTest(results, 'parser.mermaid.seedLayoutSpreadAndCenter', testMermaidSeedLayoutSpreadsGroupsAndCenters)
  await execTest(results, 'parser.graphragText.pipelineBuildsGraphAcrossDomains', testGraphRagTextPipelineBuildsGraphAcrossDomains)
  await execTest(results, 'parser.graphragText.pipelineMatchesDemoFixture', testGraphRagTextPipelineMatchesDemoFixture)
  await execTest(results, 'parser.graphragText.parserSpecMatchesTxt', testGraphRagTextParserSpecMatchesTxt)
  await execTest(results, 'parser.graphragText.bestMatchPrefersGraphRagOnPlainMd', testGraphRagTextParserSelectionPrefersGraphRagOnPlainMd)
}
