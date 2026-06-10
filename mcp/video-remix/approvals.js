// Approval-gate normalization + gate-catalog projection for the video-remix
// Director runtime. Extracted verbatim from `mcp/video-remix-runtime.js`
// (reuse-not-rebuild).

import { APPROVAL_GATES } from "./constants.js";
import { cleanString } from "./helpers.js";

function normalizeApprovals(value) {
  const approvals = Array.isArray(value) ? value : [];
  const approved = new Set();
  for (const approval of approvals) {
    if (typeof approval === "string") {
      const gateId = cleanString(approval);
      if (gateId) approved.add(gateId);
      continue;
    }
    const gateId = cleanString(approval?.gateId || approval?.id);
    const approvedState = cleanString(approval?.approvalState || approval?.state || "approved") === "approved";
    const hasToken = cleanString(approval?.token || approval?.approvalToken || gateId);
    if (gateId && approvedState && hasToken) approved.add(gateId);
  }
  return approved;
}

function buildApprovalGates(approvedGateIds) {
  return APPROVAL_GATES.map((gate) => ({
    ...gate,
    approvalState: approvedGateIds.has(gate.id) ? "approved" : "required",
    tokenRequired: true,
  }));
}

function hasGate(approvedGateIds, gateId) {
  return approvedGateIds.has(gateId);
}

export { normalizeApprovals, buildApprovalGates, hasGate };
