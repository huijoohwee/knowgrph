import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function execExact(executable, argv, { cwd, env, timeoutMs, maxOutputBytes, signal = undefined }) {
  try {
    const result = await execFileAsync(executable, argv, { cwd, env, timeout: timeoutMs, maxBuffer: maxOutputBytes, encoding: "utf8", windowsHide: true, shell: false, signal, killSignal: "SIGKILL" });
    return { ok: true, code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { ok: false, code: Number.isInteger(error.code) ? error.code : null, signal: error.signal || null, stdout: error.stdout || "", stderr: error.stderr || "", message: error.message };
  }
}
