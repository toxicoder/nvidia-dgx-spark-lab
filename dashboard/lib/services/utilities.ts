/**
 * Lab utility script discovery and execution (`scripts/utilities/*.sh`).
 * Only scripts in {@link ALLOWED_UTILITIES} may run; results are persisted to SQLite.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { withMock } from "../host";
import { ALLOWED_UTILITIES } from "../allowed-utilities";
import { fakeUtilities, fakeUtilityStatus } from "../mocks/fixtures";
import { recordUtilityRun } from "../db/repositories/utility-runs";
import type { UtilityInfo, UtilityRunResult, UtilityStatus } from "../types";

const execFileAsync = promisify(execFile);

/** Re-export allowlisted utility script names. */
export { ALLOWED_UTILITIES } from "../allowed-utilities";

function getUtilitiesDir(): string {
  const ws = process.env.BUILD_WORKSPACE_DIRECTORY;
  if (ws) {
    const fromWs = path.join(ws, "scripts", "utilities");
    if (fs.existsSync(fromWs)) return fromWs;
  }

  const candidates = [
    path.resolve(process.cwd(), "../scripts/utilities"),
    path.resolve(process.cwd(), "../../scripts/utilities"),
    "/app/scripts/utilities",
    path.resolve(__dirname, "../../../scripts/utilities"),
    path.resolve(__dirname, "../../../../scripts/utilities")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), "../scripts/utilities");
}

/**
 * Discover allowlisted utility scripts in `scripts/utilities/`.
 * @returns Array of `{ name, path }` for each `.sh` file in the allowlist.
 */
export function listUtilities(): UtilityInfo[] {
  return withMock(fakeUtilities, () => {
    const dir = getUtilitiesDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sh"))
      .map((f) => {
        const name = f.replace(/\.sh$/, "");
        return { name, path: path.join(dir, f) };
      })
      .filter((u) => ALLOWED_UTILITIES.has(u.name));
  }) as UtilityInfo[];
}

/**
 * Query a utility's `status --json` output.
 * @param name - Utility script name (without `.sh`).
 * @returns Parsed status JSON or `{ error }` shape on script failure.
 * @throws When utility name is unknown.
 */
export async function getUtilityStatus(name: string): Promise<UtilityStatus> {
  return withMock({ ...fakeUtilityStatus, name }, async () => {
    const info = listUtilities().find((u) => u.name === name);
    if (!info) throw new Error(`Unknown utility: ${name}`);

    try {
      const { stdout } = await execFileAsync(info.path, ["status", "--json"], {
        timeout: 8000,
        maxBuffer: 1024 * 64
      });
      return JSON.parse(stdout.trim()) as UtilityStatus;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  });
}

/**
 * Execute a utility script and persist the run to SQLite.
 * @param name - Utility script name (without `.sh`).
 * @param args - CLI args; defaults to `["run"]` when empty.
 * @returns Captured stdout, stderr, and exit code.
 * @throws When utility name is unknown.
 */
export async function runUtility(name: string, args: string[] = []): Promise<UtilityRunResult> {
  const info = listUtilities().find((u) => u.name === name);
  if (!info) throw new Error(`Unknown utility: ${name}`);

  if (process.env.USE_MOCKS === "1") {
    const payload =
      process.env.VISUAL_TEST === "1"
        ? {
            ok: true,
            utility: name,
            spark_time: "2026-06-28T12:00:00Z",
            nodes: ["dgx-spark-1", "dgx-spark-2"]
          }
        : { ok: true, mock: true, name, args };
    return {
      stdout: JSON.stringify(payload, null, 2),
      stderr: "",
      exitCode: 0
    };
  }

  const finalArgs = args.length > 0 ? args : ["run"];

  try {
    const result = await execFileAsync(info.path, finalArgs, {
      timeout: 120000,
      maxBuffer: 1024 * 512
    });
    const out = { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
    await recordUtilityRun({ name, ...out });
    return out;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    const out = {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || String(e),
      exitCode: err.code ?? 1
    };
    await recordUtilityRun({ name, ...out });
    return out;
  }
}
