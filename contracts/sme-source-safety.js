export const SME_SOURCE_FIELDS = Object.freeze([
  "profile_id",
  "industry",
  "size",
  "growth_stage",
  "assets",
  "digital_footprint",
  "suppliers",
  "declared_coverage",
]);

const SENSITIVE_KEY = /(?:^|_)(?:uen|registry|registration|bank|account|iban|swift|bic|password|passwd|secret|token|api_?key|credential|private_?key)(?:_|$)/i;
const SENSITIVE_VALUE = /(?:BEGIN [A-Z ]*PRIVATE KEY|\bbearer\s+[a-z0-9._~-]+|\bsk-[a-z0-9_-]{8,}|\b(?:api[_ -]?key|password|secret)\s*[:=]|\b(?:uen|company registration|registry id|bank account|iban|swift|bic)\s*[:#=]|\b[ST]\d{2}[A-Z]{2}\d{4}[A-Z]\b|\b\d{9}[A-Z]\b)/i;
const MAX_SCAN_DEPTH = 12;
const MAX_SCAN_ENTRIES = 2_000;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function inspectSmeSourceSafety(value) {
  const rejectedFields = new Set();
  let scannedEntries = 0;

  const scan = (entry, path, depth) => {
    if (depth > MAX_SCAN_DEPTH || scannedEntries >= MAX_SCAN_ENTRIES) {
      rejectedFields.add(path || "source");
      return;
    }
    scannedEntries += 1;
    if (typeof entry === "string") {
      if (SENSITIVE_VALUE.test(entry)) rejectedFields.add(path || "source");
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => scan(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (!isRecord(entry)) return;
    for (const [key, item] of Object.entries(entry)) {
      const itemPath = path ? `${path}.${key}` : key;
      if (SENSITIVE_KEY.test(key)) rejectedFields.add(itemPath);
      else scan(item, itemPath, depth + 1);
    }
  };

  scan(value, "", 0);
  return {
    safe: rejectedFields.size === 0,
    rejected_fields: [...rejectedFields].sort(),
    scanned_entries: scannedEntries,
    bounded: scannedEntries < MAX_SCAN_ENTRIES,
  };
}

export function summarizeSmeSource(value) {
  const record = isRecord(value) ? value : {};
  const declaredFields = SME_SOURCE_FIELDS.filter((field) => {
    const entry = record[field];
    return entry !== undefined && entry !== null && entry !== "" && entry !== "undeclared";
  });
  return {
    source_kind: "redacted_sme_profile",
    declared_fields: declaredFields,
    missing_fields: SME_SOURCE_FIELDS.filter((field) => !declaredFields.includes(field)),
    redaction_state: "safe",
  };
}
