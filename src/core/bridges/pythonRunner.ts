import { spawn } from "node:child_process";

/**
 * Cross-platform Python script executor.
 * Uses child_process.spawn with shell: false to avoid cmd.exe quote and newline mangling on Windows.
 * Automatically tries 'python', then falls back to 'python3' if not found or if Store stub fails.
 */
export async function runPythonScript(script: string, args: string[] = []): Promise<string> {
  const trySpawn = (cmd: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, ["-c", script, ...args], { shell: false });
      let stdout = "";
      let stderr = "";

      const timeoutId = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        child.kill("SIGKILL");
        reject(new Error(`Python process '${cmd}' timed out after 60s`));
      }, 60000);

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString("utf8");
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      child.on("close", (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(stdout);
        } else {
          const errMessage = stderr.trim() || `Python process '${cmd}' exited with code ${code}`;
          reject(new Error(errMessage));
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  };

  try {
    const res = await trySpawn("python");
    // Check for Windows Store app execution alias redirect / prompt
    if (res.includes("Microsoft Store") || res.includes("Python was not found")) {
      return await trySpawn("python3");
    }
    return res;
  } catch (err: any) {
    if (err?.code === "ENOENT" || String(err?.message).includes("Microsoft Store") || String(err?.message).includes("Python was not found")) {
      return await trySpawn("python3");
    }
    throw err;
  }
}
