export type AgentReadyOnboarding = {
  publicReadMcpUrl?: string
  controlPlaneMcpUrl?: string
  cheapestProofPath?: string
  steps?: Array<{ order?: number; label?: string; action?: string }>
}

export function assertAgentReadyOnboardingHtml(html: string) {
  if (!html.includes('Fastest Path') || !html.includes('control-plane/mcp') || !html.includes('knowgrph-superagent-harness.md')) {
    throw new Error('expected MCP Apps HTML to expose the fastest onboarding path')
  }
}

export function assertAgentReadyOnboardingReadiness(onboarding?: AgentReadyOnboarding) {
  if (onboarding?.publicReadMcpUrl !== 'https://airvio.co/knowgrph/mcp'
    || onboarding?.controlPlaneMcpUrl !== 'https://airvio.co/knowgrph/control-plane/mcp'
    || !String(onboarding?.cheapestProofPath || '').includes('knowgrph-superagent-harness.md')
    || !Array.isArray(onboarding?.steps)
    || onboarding.steps.length !== 3
    || !String(onboarding.steps[1]?.action || '').includes('live /, #, @ grammar lookup')) {
    throw new Error(`expected readiness onboarding details to expose the install-first sequence, got ${JSON.stringify(onboarding)}`)
  }
}
