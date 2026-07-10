import { escapeHtml, normalizeString as clean } from './mcpAppsContractText.mjs'

export const resolveMcpOnboardingUrls = ({ baseUrl, transportUrl, surfaceRoles } = {}) => {
  const base = clean(baseUrl).replace(/\/+$/, '')
  return {
    publicReadMcpUrl: clean(surfaceRoles?.publicReadMcpUrl) || clean(transportUrl) || (base ? `${base}/mcp` : ''),
    controlPlaneMcpUrl: clean(surfaceRoles?.controlPlaneMcpUrl) || (base ? `${base}/control-plane/mcp` : ''),
  }
}

export const buildMcpOnboarding = ({ publicReadMcpUrl, controlPlaneMcpUrl } = {}) => ({
  publicReadMcpUrl: clean(publicReadMcpUrl),
  controlPlaneMcpUrl: clean(controlPlaneMcpUrl),
  controlPlaneCondition: 'Add the control plane only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.',
  cheapestProofPath: 'Use the source-side README.md quick start or docs/documents/knowgrph-superagent-harness.md in the knowgrph repo before hosted setup.',
  steps: [
    { order: 1, label: 'Install public MCP first', action: publicReadMcpUrl ? `Install ${publicReadMcpUrl}.` : 'Install the public read-only MCP endpoint first.' },
    {
      order: 2,
      label: 'Add control plane only when session-capable',
      action: controlPlaneMcpUrl
        ? `Add ${controlPlaneMcpUrl} only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.`
        : 'Add the control plane only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.',
    },
    { order: 3, label: 'Use the cheapest proof path before hosted setup', action: 'Run the source-side README.md quick start or docs/documents/knowgrph-superagent-harness.md first.' },
  ],
})

export const buildMcpOnboardingHtml = ({ publicReadMcpUrl, controlPlaneMcpUrl } = {}) => `<section aria-label="Fastest path">
  <section id="onboarding" class="readiness">
    <strong>Fastest Path</strong>
    <ol>
      <li>${escapeHtml(publicReadMcpUrl ? `Install ${publicReadMcpUrl}.` : 'Install the public MCP endpoint first.')}</li>
      <li>${escapeHtml(controlPlaneMcpUrl ? `Add ${controlPlaneMcpUrl} only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.` : 'Add the control plane only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.')}</li>
      <li>Use the source-side <code>README.md</code> quick start or <code>docs/documents/knowgrph-superagent-harness.md</code> before hosted setup.</li>
    </ol>
  </section>
</section>`

export const MCP_ONBOARDING_CLIENT_SCRIPT = `const renderOnboarding = (payload) => {
  onboardingEl.replaceChildren();
  const onboarding = payload && payload.onboarding && typeof payload.onboarding === 'object' ? payload.onboarding : boot.onboarding;
  appendText(onboardingEl, 'strong', 'Fastest Path');
  const list = document.createElement('ol');
  const steps = Array.isArray(onboarding && onboarding.steps) && onboarding.steps.length ? onboarding.steps : [
    { action: onboarding && onboarding.publicReadMcpUrl ? 'Install ' + onboarding.publicReadMcpUrl + '.' : 'Install the public MCP endpoint first.' },
    { action: onboarding && onboarding.controlPlaneMcpUrl ? 'Add ' + onboarding.controlPlaneMcpUrl + ' only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.' : 'Add the control plane only when the host can preserve MCP session state and needs live /, #, @ grammar lookup.' },
    { action: onboarding && onboarding.cheapestProofPath ? onboarding.cheapestProofPath : 'Use the source-side README.md quick start or docs/documents/knowgrph-superagent-harness.md before hosted setup.' },
  ];
  for (const step of steps) appendText(list, 'li', step && step.action ? String(step.action) : 'Follow the fastest onboarding path.');
  onboardingEl.appendChild(list);
};`
