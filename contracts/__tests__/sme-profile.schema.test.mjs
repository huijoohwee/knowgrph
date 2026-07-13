import assert from "node:assert/strict";
import test from "node:test";

import {
  SME_PROFILE_SCHEMA_ID,
  SME_UNDECLARED,
  parseSmeProfileMarkdown,
  printSmeProfileMarkdown,
} from "../sme-profile.schema.js";

const profile = {
  schema: SME_PROFILE_SCHEMA_ID,
  profile_id: "synthetic-retail-01",
  industry: "retail",
  size: 12,
  growth_stage: "early",
  assets: ["inventory", "checkout equipment"],
  digital_footprint: "online ordering and staff email",
  suppliers: ["regional distributor"],
  declared_coverage: [{ category: "asset_physical", scope: "limited" }],
};

test("SME profile printing is deterministic and round-trips every schema field", () => {
  const first = printSmeProfileMarkdown(profile);
  const second = printSmeProfileMarkdown(profile);
  assert.equal(first.ok, true);
  assert.equal(first.markdown, second.markdown);
  assert.deepEqual(parseSmeProfileMarkdown(first.markdown), { ok: true, profile });
});

test("optional SME fields normalize to typed undeclared markers", () => {
  const printed = printSmeProfileMarkdown({
    schema: SME_PROFILE_SCHEMA_ID,
    profile_id: "minimal",
    industry: "services",
    size: 3,
    growth_stage: "pre_seed",
  });
  const parsed = parseSmeProfileMarkdown(printed.markdown);
  assert.equal(parsed.ok, true);
  for (const field of ["assets", "digital_footprint", "suppliers", "declared_coverage"]) {
    assert.equal(parsed.profile[field], SME_UNDECLARED);
  }
});

test("invalid profile reports the first field path and returns no partial profile", () => {
  const result = parseSmeProfileMarkdown("---\nschema: wrong\n---\n");
  assert.equal(result.ok, false);
  assert.equal(result.error.path, "schema");
  assert.equal("profile" in result, false);
});
