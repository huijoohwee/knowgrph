import { execTest, TestResult } from './testRunnerUtils'

const modJsonLdRoundtrip = () => import('@/__tests__/jsonldRoundtrip.test')
const modJsonLdInferredEdges = () => import('@/__tests__/jsonldInferredEdges.test')
const modWorkflowJsonLd = () => import('@/__tests__/workflowJsonLd.test')

export const runJsonLdTests = async (results: TestResult[]) => {
  await execTest(results, 'jsonld.roundTrip', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdRoundTrip()
  })
  await execTest(results, 'jsonld.aiVizEdges', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdAiVizEdges()
  })
  await execTest(results, 'jsonld.agenticGraphEdges', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdAgenticGraphEdges()
  })
  await execTest(results, 'jsonld.inferredEdges.compactIriArrays', async () => {
    const mod = await modJsonLdInferredEdges()
    await mod.testJsonLdInferredEdgesFromCompactIriArrays()
  })
  await execTest(results, 'jsonld.phaseMembership.kgPrefix', async () => {
    const mod = await modJsonLdInferredEdges()
    await mod.testJsonLdPhaseMembershipArraysWithKgPrefix()
  })
  await execTest(results, 'jsonld.graphRagPathInNodeProperties', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdAgenticGraphRagPathStaysInNodeProperties()
  })
  await execTest(results, 'jsonld.workerPipelineEdges', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdWorkerPipelineParsesExpectedEdges()
  })
  await execTest(results, 'jsonld.triplesExpectedSet', async () => {
    const mod = await modJsonLdRoundtrip()
    await mod.testJsonLdTriplesMatchExpectedSet()
  })
  await execTest(results, 'jsonld.workflow.historyGraphShape', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdHistoryGraphShape()
  })
  await execTest(results, 'jsonld.workflow.graphFieldSettingsGraphShape', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdGraphFieldSettingsGraphShape()
  })
  await execTest(results, 'jsonld.workflow.graphFieldSettings.agenticRagRoundTrip', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdGraphFieldSettingsAgenticRagRoundTrip()
  })
  await execTest(results, 'jsonld.workflow.graphRagWorkflowShape', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdGraphRagWorkflowShape()
  })
  await execTest(results, 'jsonld.workflow.graphRagCliYamlMapping', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdGraphRagCliYamlMapping()
  })
  await execTest(results, 'jsonld.workflow.graphRagPathGraphFieldSettingsFixture', async () => {
    const mod = await modWorkflowJsonLd()
    await mod.testWorkflowJsonLdGraphRagPathGraphFieldSettingsFixture()
  })
}
