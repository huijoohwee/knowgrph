import fs from "node:fs/promises";
import path from "node:path";

const ensureContained = (root, relativePath) => {
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`Source Files path escapes root: ${relativePath}`);
  return target;
};

export async function writeSmeSourceFilesAtomically(rootDir, files, { fsApi = fs } = {}) {
  const root = path.resolve(rootDir);
  const transaction = path.join(root, `.sme-source-files-${process.pid}-${Date.now()}`);
  const staged = path.join(transaction, "staged");
  const backups = path.join(transaction, "backups");
  const committed = [];
  await fsApi.mkdir(staged, { recursive: true });
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const target = ensureContained(root, relativePath);
      const candidate = ensureContained(staged, relativePath);
      await fsApi.mkdir(path.dirname(candidate), { recursive: true });
      await fsApi.writeFile(candidate, content, "utf8");
      committed.push({ relativePath, target, candidate, existed: false });
    }
    for (const entry of committed) {
      await fsApi.mkdir(path.dirname(entry.target), { recursive: true });
      try {
        await fsApi.access(entry.target);
        entry.existed = true;
        const backup = ensureContained(backups, entry.relativePath);
        await fsApi.mkdir(path.dirname(backup), { recursive: true });
        await fsApi.rename(entry.target, backup);
        entry.backup = backup;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await fsApi.rename(entry.candidate, entry.target);
      entry.installed = true;
    }
  } catch (error) {
    for (const entry of [...committed].reverse()) {
      try { if (entry.installed) await fsApi.rm(entry.target, { force: true }); } catch {}
      try { if (entry.backup) await fsApi.rename(entry.backup, entry.target); } catch {}
    }
    throw error;
  } finally {
    await fsApi.rm(transaction, { recursive: true, force: true });
  }
  return { paths: committed.map((entry) => entry.relativePath), count: committed.length };
}
