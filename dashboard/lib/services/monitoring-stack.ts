/** Observability stack status via `scripts/utilities/monitoring-stack.sh`. */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { mockMonitoringStackStatus } from "../mocks/fixtures";
import type { MonitoringStackStatus } from "../types";
import { withMock } from "../host";

const execFileAsync = promisify(execFile);

function resolveMonitoringStackScript(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "monitoring-stack.sh");
    if (existsSync(fromWs)) return fromWs;
  }
  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/monitoring-stack.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/monitoring-stack.sh"),
    "/app/scripts/utilities/monitoring-stack.sh",
    path.resolve(__dirname, "../../../scripts/utilities/monitoring-stack.sh")
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/monitoring-stack.sh");
}

async function runMonitoringStack(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const script = resolveMonitoringStackScript();
  try {
    const { stdout, stderr } = await execFileAsync(script, args, {
      env: { ...process.env, REPO_ROOT: path.dirname(path.dirname(path.dirname(script))) },
      timeout: 120_000,
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
 * Fetch Grafana/Headlamp monitoring stack status.
 * @returns Per-service pod counts, URLs, and stack state.
 * @throws When `monitoring-stack.sh status` exits non-zero.
 */
export async function getMonitoringStackStatus(): Promise<MonitoringStackStatus> {
  return withMock(mockMonitoringStackStatus(), async () => {
    const { stdout, exitCode } = await runMonitoringStack(["status", "--json"]);
    if (exitCode !== 0) throw new Error(stdout || "monitoring-stack status failed");
    return JSON.parse(stdout.trim()) as MonitoringStackStatus;
  });
}
