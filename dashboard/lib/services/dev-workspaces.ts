/** Coder/Kasm dev workspace status and lifecycle via `scripts/utilities/dev-workspaces.sh`. */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { withMock } from "../host";
import { fakeDevWorkspacesStatus } from "../mocks/fixtures";
import type { DevWorkspaceName, DevWorkspacesStatus } from "../types";

const execFileAsync = promisify(execFile);

function getUtilityPath(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities", "dev-workspaces.sh");
    if (fs.existsSync(fromWs)) return fromWs;
  }

  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities/dev-workspaces.sh"),
    path.resolve(process.cwd(), "../../scripts/utilities/dev-workspaces.sh"),
    "/app/scripts/utilities/dev-workspaces.sh",
    path.resolve(__dirname, "../../../scripts/utilities/dev-workspaces.sh"),
    path.resolve(__dirname, "../../../../scripts/utilities/dev-workspaces.sh")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities/dev-workspaces.sh");
}

function workspaceUrl(name: DevWorkspaceName): string {
  const envKey = name === "coder" ? "NEXT_PUBLIC_CODER_URL" : "NEXT_PUBLIC_KASM_URL";
  const override = process.env[envKey];
  if (override) return override;

  const host = process.env.LAB_WORKSPACE_HOST || "localhost";
  const port = name === "coder" ? process.env.CODER_PORT || "32080" : process.env.KASM_PORT || "32081";
  return `http://${host}:${port}`;
}

function applyUrlOverrides(status: DevWorkspacesStatus): DevWorkspacesStatus {
  return {
    ...status,
    coder: { ...status.coder, url: workspaceUrl("coder") },
    kasm: { ...status.kasm, url: workspaceUrl("kasm") }
  };
}

/**
 * Fetch Coder and Kasm workspace pod/helm status with dashboard URLs.
 * @returns Combined workspace status for both `coder` and `kasm`.
 */
export async function getDevWorkspacesStatus(): Promise<DevWorkspacesStatus> {
  return withMock(applyUrlOverrides(fakeDevWorkspacesStatus), async () => {
    const utility = getUtilityPath();
    if (!fs.existsSync(utility)) {
      return {
        coder: {
          name: "coder",
          state: "error",
          readyPods: 0,
          totalPods: 0,
          url: workspaceUrl("coder"),
          helmInstalled: false
        },
        kasm: {
          name: "kasm",
          state: "error",
          readyPods: 0,
          totalPods: 0,
          url: workspaceUrl("kasm"),
          helmInstalled: false
        },
        error: `Utility not found: ${utility}`
      };
    }

    try {
      const { stdout } = await execFileAsync(utility, ["status", "--json"], {
        timeout: 15000,
        maxBuffer: 1024 * 64
      });
      const parsed = JSON.parse(stdout.trim()) as DevWorkspacesStatus;
      return applyUrlOverrides(parsed);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        coder: {
          name: "coder",
          state: "error",
          readyPods: 0,
          totalPods: 0,
          url: workspaceUrl("coder"),
          helmInstalled: false
        },
        kasm: {
          name: "kasm",
          state: "error",
          readyPods: 0,
          totalPods: 0,
          url: workspaceUrl("kasm"),
          helmInstalled: false
        },
        error: message
      };
    }
  });
}

/**
 * Start a dev workspace (Coder or Kasm).
 * @param name - Workspace id (`coder` or `kasm`).
 * @returns Script stdout, stderr, and exit code.
 */
export async function startDevWorkspace(
  name: DevWorkspaceName
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (process.env.USE_MOCKS === "1") {
    return { stdout: JSON.stringify({ ok: true, action: "start", name }), stderr: "", exitCode: 0 };
  }

  const utility = getUtilityPath();
  try {
    const result = await execFileAsync(utility, ["run", name], {
      timeout: 600000,
      maxBuffer: 1024 * 512
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || String(e),
      exitCode: err.code ?? 1
    };
  }
}

/**
 * Stop a dev workspace (Coder or Kasm).
 * @param name - Workspace id (`coder` or `kasm`).
 * @returns Script stdout, stderr, and exit code.
 */
export async function stopDevWorkspace(
  name: DevWorkspaceName
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (process.env.USE_MOCKS === "1") {
    return { stdout: JSON.stringify({ ok: true, action: "stop", name }), stderr: "", exitCode: 0 };
  }

  const utility = getUtilityPath();
  try {
    const result = await execFileAsync(utility, ["stop", name], {
      timeout: 120000,
      maxBuffer: 1024 * 256
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || String(e),
      exitCode: err.code ?? 1
    };
  }
}
