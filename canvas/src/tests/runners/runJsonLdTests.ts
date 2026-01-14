import { execTest, TestResult } from './testRunnerUtils'
import {
  testJsonLdRoundTrip,
  testJsonLdAiVizEdges,
  testJsonLdAgenticGraphEdges,
  testJsonLdAgenticGraphRagPathStaysInNodeProperties,
  testJsonLdWorkerPipelineParsesExpectedEdges,
  testJsonLdTriplesMatchExpectedSet,
} from '@/__tests__/jsonldRoundtrip.test'
import {
  testJsonLdInferredEdgesFromCompactIriArrays,
  testJsonLdPhaseMembershipArraysWithKgPrefix,
} from '@/__tests__/jsonldInferredEdges.test'
import {
  testWorkflowJsonLdHistoryGraphShape,
  testWorkflowJsonLdGraphFieldSettingsGraphShape,
  testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip,
  testWorkflowJsonLdGraphRagWorkflowShape,
  testWorkflowJsonLdGraphRagCliYamlMapping,
  testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture,
} from '@/__tests__/workflowJsonLd.test'

export const runJsonLdTests = async (results: TestResult[]) => {
  await execTest(results, 'jsonld.roundTrip', testJsonLdRoundTrip)
  await execTest(results, 'jsonld.aiVizEdges', testJsonLdAiVizEdges)
  await execTest(results, 'jsonld.agenticGraphEdges', testJsonLdAgenticGraphEdges)
  await execTest(
    results,
    'jsonld.inferredEdges.compactIriArrays',
    testJsonLdInferredEdgesFromCompactIriArrays,
  )
  await execTest(results, 'jsonld.phaseMembership.kgPrefix', testJsonLdPhaseMembershipArraysWithKgPrefix)
  await execTest(
    results,
    'jsonld.graphRagPathInNodeProperties',
    testJsonLdAgenticGraphRagPathStaysInNodeProperties,
  )
  await execTest(results, 'jsonld.workerPipelineEdges', testJsonLdWorkerPipelineParsesExpectedEdges)
  await execTest(results, 'jsonld.triplesExpectedSet', testJsonLdTriplesMatchExpectedSet)
  await execTest(results, 'jsonld.workflow.historyGraphShape', testWorkflowJsonLdHistoryGraphShape)
  await execTest(
    results,
    'jsonld.workflow.graphFieldSettingsGraphShape',
    testWorkflowJsonLdGraphFieldSettingsGraphShape,
  )
  await execTest(
    results,
    'jsonld.workflow.graphFieldSettings.agenticRagRoundTrip',
    testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip,
  )
  await execTest(results, 'jsonld.workflow.graphRagWorkflowShape', testWorkflowJsonLdGraphRagWorkflowShape)
  await execTest(results, 'jsonld.workflow.graphRagCliYamlMapping', testWorkflowJsonLdGraphRagCliYamlMapping)
  await execTest(
    results,
    'jsonld.workflow.graphRagPathGraphFieldSettingsFixture',
    testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture,
  )
}
