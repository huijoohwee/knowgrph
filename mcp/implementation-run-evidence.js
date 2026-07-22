import crypto from "node:crypto";

const TRUNCATION_MARKER = "\n…[bounded output truncated]\n";

export function decodeBoundedUtf8(value, maximumBytes) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let length = Math.max(0, Math.min(buffer.length, maximumBytes));
  while (length > 0) {
    const value = buffer.subarray(0, length).toString("utf8");
    if (Buffer.byteLength(value) <= maximumBytes) return value;
    length -= 1;
  }
  return "";
}

export function boundOutput(value, maximumBytes) {
  const limit = Math.max(0, Number(maximumBytes) || 0);
  const input = Buffer.from(String(value || ""), "utf8");
  if (input.length <= limit) return { content: input.toString("utf8"), bytes: input.length, truncated: false };
  const marker = Buffer.from(TRUNCATION_MARKER, "utf8");
  const suffix = decodeBoundedUtf8(marker, limit);
  const available = Math.max(0, limit - Buffer.byteLength(suffix));
  const prefix = decodeBoundedUtf8(input, available);
  const content = `${prefix}${suffix}`;
  return { content, bytes: Buffer.byteLength(content), truncated: true };
}

export function redactEvidence(value, secrets, maximumBytes) {
  let output = String(value || "");
  for (const secret of secrets.filter((entry) => String(entry).length >= 4)) output = output.split(String(secret)).join("[REDACTED]");
  output = output.replace(/\b(authorization|credential|password|secret|token)\b\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]");
  return boundOutput(output, maximumBytes);
}

export function digestEvidence(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}

export async function writeEvidenceArtifact({ store, runId, fileName, content, supervisorToken, truncated = false }) {
  const value = String(content);
  const artifactPath = await store.writeArtifact(runId, fileName, value, { supervisorToken });
  return { path: artifactPath, artifact: fileName, digest: digestEvidence(value), bytes: Buffer.byteLength(value), truncated: Boolean(truncated) };
}
