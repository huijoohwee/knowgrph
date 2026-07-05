import test from "node:test";
import assert from "node:assert/strict";

import { APPROVAL_TOKEN_TTL_MS } from "../approval.schema.js";
import {
  APPROVAL_GATE_ID,
  APPROVAL_GATE_ID_VALUES,
  STAGE_ID,
  STAGE_ID_VALUES,
} from "../run-manifest.schema.js";

test("Video_Agent contract enums extend without modifying existing gate ids or TTL", () => {
  assert.equal(APPROVAL_GATE_ID.CONSUMER_REPO_WRITE, "consumer-repo-write");
  assert.equal(APPROVAL_GATE_ID.CLOUD_DEPLOY, "cloud-deploy");
  assert.equal(APPROVAL_GATE_ID.PAID_MODEL_CALL, "paid-model-call");
  assert.equal(APPROVAL_GATE_ID.RENDER_ACTION, "render-action");
  assert.equal(APPROVAL_GATE_ID.PAYMENT_ACTION, "payment-action");
  assert.equal(APPROVAL_GATE_ID.AUTHENTICATED_BROWSER, "authenticated-browser");
  assert.equal(APPROVAL_TOKEN_TTL_MS, 15 * 60 * 1000);

  assert.equal(STAGE_ID.EDIT, "edit");
  assert.equal(APPROVAL_GATE_ID.EDIT_MANIFEST_ASSEMBLY, "edit-manifest-assembly");
  assert.equal(STAGE_ID_VALUES.includes("edit"), true);
  assert.equal(APPROVAL_GATE_ID_VALUES.includes("edit-manifest-assembly"), true);
});
