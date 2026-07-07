/** Open WebUI control via `scripts/utilities/open-webui-stack.sh`. */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { mockOpenWebUICatalog, mockOpenWebUIStatus } from "../mocks/fixtures";
import type { OpenWebUICatalog, OpenWebUIStatus } from "../types";
import { withMock } from "../host";

const execFileAsync = promisify(execFile);

function resolveOpenWebUIStackScript(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "open-webui-stack.sh");
    if (existsSync(fromWs)) return fromWs;
  }
  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/open-webui-stack.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/open-webui-stack.sh"),
    "/app/scripts/utilities/open-webui-stack.sh",
    path.resolve(__dirname, "../../../scripts/utilities/open-webui-stack.sh")
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/open-webui-stack.sh");
}

async function runOpenWebUIStack(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const script = resolveOpenWebUIStackScript();
  try {
    const { stdout, stderr } = await execFileAsync(script, args, {
      env: { ...process.env, REPO_ROOT: path.dirname(path.dirname(path.dirname(script))) },
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? String(e),
      exitCode: typeof err.code === "number" ? err.code : 1
    };
  }
}

/**
 * Fetch Open WebUI stack catalog JSON.
 * @returns Stack definitions and endpoint metadata.
 * @throws When `open-webui-stack.sh catalog` exits non-zero.
 */
export async function getOpenWebUICatalog(): Promise<OpenWebUICatalog> {
  return withMock(mockOpenWebUICatalog(), async () => {
    const { stdout, exitCode } = await runOpenWebUIStack(["catalog", "--json"]);
    if (exitCode !== 0) throw new Error(stdout || "open-webui-stack catalog failed");
    return JSON.parse(stdout.trim()) as OpenWebUICatalog;
  });
}

/**
 * Fetch Open WebUI stack runtime status.
 * @returns Pod readiness, URLs, and stack state.
 * @throws When `open-webui-stack.sh status` exits non-zero.
 */
export async function getOpenWebUIStatus(): Promise<OpenWebUIStatus> {
  return withMock(mockOpenWebUIStatus(), async () => {
    const { stdout, exitCode } = await runOpenWebUIStack(["status", "--json"]);
    if (exitCode !== 0) throw new Error(stdout || "open-webui-stack status failed");
    return JSON.parse(stdout.trim()) as OpenWebUIStatus;
  });
}

/**
 * Start an Open WebUI stack deployment.
 * @param stackId - Stack id to start.
 * @param confirm - Heavy-stack confirmation (`yes`).
 * @returns Script stdout, stderr, and exit code.
 */
export async function startOpenWebUI(
  stackId: string,
  confirm: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runOpenWebUIStack(["start", stackId, "--confirm", confirm]);
}

/**
 * Stop the Open WebUI lab stack.
 * @returns Script stdout, stderr, and exit code.
 */
export async function stopOpenWebUI(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return runOpenWebUIStack(["stop"]);
}
