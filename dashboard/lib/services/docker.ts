import { exec, execFile } from "child_process";
import { promisify } from "util";
import { withMock } from "../host";
import { fakeContainers } from "../mocks/fixtures";
import { ContainerIdSchema } from "../validation";
import type { DockerContainer, DockerListResult } from "../types";

/**
 * Docker integration service for the Tasks panel.
 *
 * Socket source:
 * - Relies on the host's /var/run/docker.sock being bind-mounted into the container
 *   (see docker-compose.yml volumes and dev k8s overlays).
 * - This is the mechanism that lets the dashboard list and control host containers
 *   (used by Tasks — docker section).
 *
 * Implementation notes:
 * - Uses child_process (exec/execFile) + promisify. No heavy dockerode dep to keep
 *   image small and attack surface low.
 * - 'docker ps --format "{{json .}}"' produces one JSON line per container (newline split).
 * - Timeouts: short for list (4s), longer for stop (15s) to accommodate slow container shutdown.
 * - Graceful degradation: any failure (no socket, permission, docker down) returns { error: "..." }
 *   shape. UI (TasksPanel/TasksContainerList) detects array vs error and renders accordingly.
 * - Validation: stopContainer uses zod ContainerIdSchema before shell.
 *
 * Testing:
 * - All paths hermetic via withMock() + USE_MOCKS=1 (see vitest.setup.ts, run-hermetic-tests.sh,
 *   scripts/test-entrypoint.sh, BATS-equivalent coverage in dashboard unit tests).
 * - Mocks come from lib/mocks/fixtures.ts .
 *
 * Safety / scoping:
 * - Never called for arbitrary user input; only lab admin flows behind session.
 * - No image pull / run / exec into containers here — only ps + stop.
 * - Companion: higher-level guards in middleware, require-session, host-actions.
 *
 * Related:
 * - docker-compose.yml (detailed sock mount comments)
 * - components/Tasks* , actions/host-actions.ts (the server action wrapper)
 */

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * List running containers (or error shape).
 * Uses docker CLI JSON lines. Returns DockerListResult union for easy UI branching.
 */
export async function listContainers(): Promise<DockerListResult> {
  return withMock(fakeContainers, async () => {
    try {
      const { stdout } = await execAsync('docker ps --format "{{json .}}"', {
        timeout: 4000
      });
      return stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l: string) => JSON.parse(l) as DockerContainer);
    } catch {
      // Explicit error object so callers never throw and UI can show friendly state.
      return { error: "docker not available or permission denied" };
    }
  });
}

/**
 * Stop a container by (validated) id.
 * Id is pre-validated; execFile avoids shell interpretation.
 */
export async function stopContainer(id: string): Promise<{ stopped: string }> {
  const parsed = ContainerIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new Error("invalid container id");
  }
  return withMock({ stopped: id }, async () => {
    await execFileAsync("docker", ["stop", id], { timeout: 15000 });
    return { stopped: id };
  });
}
