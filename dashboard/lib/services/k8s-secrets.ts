/** Sync vault secrets to allowed K8s namespaces (`dev`, `ai-inference`) via kubectl. */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { withMock } from "../host";
import type { K8sSyncTarget } from "../types";

const execFileAsync = promisify(execFile);

const ALLOWED_NAMESPACES = new Set(["dev", "ai-inference"]);

/** Result of a kubectl secret sync or key removal operation. */
export interface K8sSecretSyncResult {
  ok: boolean;
  error?: string;
}

function validateTarget(target: K8sSyncTarget): void {
  if (!ALLOWED_NAMESPACES.has(target.namespace)) {
    throw new Error(`Namespace not allowed: ${target.namespace}`);
  }
}

async function writeTempSecretFile(plaintext: string): Promise<{ dir: string; file: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lab-secret-"));
  const file = path.join(dir, "value");
  await fs.promises.writeFile(file, plaintext, { mode: 0o600 });
  return { dir, file };
}

async function cleanupTemp(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

async function applyManifest(content: string, tmpDir: string): Promise<void> {
  const manifestPath = path.join(tmpDir, "manifest.json");
  await fs.promises.writeFile(manifestPath, content, { mode: 0o600 });
  await execFileAsync("kubectl", ["apply", "-f", manifestPath], {
    timeout: 30000,
    maxBuffer: 1024 * 256
  });
}

/**
 * Upsert a Kubernetes Secret key from plaintext (value never logged).
 * @param target - Namespace, secret name, and key (allowlisted namespaces only).
 * @param plaintext - Secret value written to a temp file for `kubectl create`.
 * @returns `{ ok: true }` or `{ ok: false, error }` on kubectl failure.
 * @throws When namespace is not in the allowlist.
 */
export async function syncSecretToK8s(target: K8sSyncTarget, plaintext: string): Promise<K8sSecretSyncResult> {
  return withMock({ ok: true }, async () => {
    validateTarget(target);
    const { dir, file } = await writeTempSecretFile(plaintext);
    try {
      const { stdout } = await execFileAsync(
        "kubectl",
        [
          "create",
          "secret",
          "generic",
          target.secretName,
          `--from-file=${target.key}=${file}`,
          "-n",
          target.namespace,
          "--dry-run=client",
          "-o",
          "yaml"
        ],
        { timeout: 30000, maxBuffer: 1024 * 256 }
      );

      await applyManifest(stdout, dir);
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    } finally {
      await cleanupTemp(dir);
    }
  });
}

/**
 * Remove a key from a synced secret; delete the Secret if empty.
 * @param target - Namespace, secret name, and key to remove.
 * @returns `{ ok: true }` or `{ ok: false, error }` on kubectl failure.
 * @throws When namespace is not in the allowlist.
 */
export async function removeK8sSecretKey(target: K8sSyncTarget): Promise<K8sSecretSyncResult> {
  return withMock({ ok: true }, async () => {
    validateTarget(target);
    try {
      const { stdout } = await execFileAsync(
        "kubectl",
        ["get", "secret", target.secretName, "-n", target.namespace, "-o", "json"],
        { timeout: 20000, maxBuffer: 1024 * 256 }
      );

      const secret = JSON.parse(stdout) as {
        metadata?: { name?: string; namespace?: string };
        data?: Record<string, string>;
      };

      if (!secret.data || !(target.key in secret.data)) {
        return { ok: true };
      }

      delete secret.data[target.key];
      const remaining = Object.keys(secret.data);

      if (remaining.length === 0) {
        await execFileAsync("kubectl", ["delete", "secret", target.secretName, "-n", target.namespace], {
          timeout: 20000,
          maxBuffer: 1024 * 64
        });
        return { ok: true };
      }

      const patchDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lab-secret-patch-"));
      try {
        await applyManifest(JSON.stringify(secret), patchDir);
      } finally {
        await cleanupTemp(patchDir);
      }

      return { ok: true };
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      if (err.stderr?.includes("NotFound") || err.message?.includes("NotFound")) {
        return { ok: true };
      }
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  });
}
