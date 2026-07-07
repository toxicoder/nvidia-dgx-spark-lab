/**
 * Host identity and OS inventory via shell commands.
 * Mocked under `USE_MOCKS=1` using fixtures from `lib/mocks/fixtures.ts`.
 */
import { exec } from "child_process";
import { promisify } from "util";
import { withMock } from "../host";
import { fakeMachineIdentity, fakeServices, fakePackages } from "../mocks/fixtures";
import type { MachineIdentity, PackageList, RunningServices } from "../types";

const execAsync = promisify(exec);

/**
 * Read host identity and primary GPU driver info.
 * @returns Hostname and first `nvidia-smi` GPU line (or fallback message).
 */
export async function getMachineIdentity(): Promise<MachineIdentity> {
  return withMock(fakeMachineIdentity, async () => {
    const host = (await execAsync("uname -n")).stdout.trim();
    let nvidia = "nvidia-smi unavailable";
    try {
      nvidia = (
        await execAsync("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>/dev/null | head -1")
      ).stdout.trim();
    } catch {
      /* nvidia-smi unavailable */
    }
    return { hostname: host, nvidia };
  });
}

/**
 * List running systemd service units (truncated).
 * @returns Up to 15 running service unit lines.
 */
export async function getRunningServices(): Promise<RunningServices> {
  return withMock(fakeServices, async () => {
    try {
      const { stdout } = await execAsync(
        "systemctl list-units --type=service --state=running --no-pager --plain | head -15"
      );
      return { services: stdout.trim().split("\n").filter(Boolean) };
    } catch {
      return { services: ["systemctl unavailable"] };
    }
  });
}

/**
 * Sample installed Debian packages via `dpkg -l`.
 * @param limit - Maximum package names to return (default 50).
 * @returns Package name list.
 */
export async function getPackages(limit = 50): Promise<PackageList> {
  return withMock(fakePackages, async () => {
    try {
      const { stdout } = await execAsync(`dpkg -l | awk '{print $2}' | head -${limit}`);
      return { packages: stdout.trim().split("\n").filter(Boolean) };
    } catch {
      return { packages: [] };
    }
  });
}
