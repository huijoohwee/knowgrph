// Central scene-handler boundary for 2D label presentation and collision culling.
// D3 label visibility is driven through the shared `data-collide-hidden` contract.
export { attachSimulationTick } from '@/components/GraphCanvas/sceneHandlers.simulationTick2d'
export { attachGlobalHandlers } from '@/components/GraphCanvas/sceneHandlers.globalHandlers2d'
export { renderLabels2d } from '@/components/GraphCanvas/sceneHandlers.simulationTick2d.labels'
export { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
