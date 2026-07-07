import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, resetDbForTests } from "@/lib/db";
import {
  appendAuditEvent,
  createSecret,
  decryptSecretValue,
  deleteSecret,
  getSecretMeta,
  listSecrets,
  updateSecretMeta,
  updateSecretValue
} from "../lab-secrets";
import { labSecrets, secretAuditEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("lab-secrets repository", () => {
  let dbPath: string;
  const prevKey = process.env.LAB_SECRETS_MASTER_KEY;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `secrets-test-${Date.now()}.db`);
    resetDbForTests(dbPath);
    process.env.USE_MOCKS = "0";
    process.env.LAB_SECRETS_MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
    migrate(getDb(), {
      migrationsFolder: path.join(__dirname, "../../migrations")
    });
  });

  afterEach(() => {
    resetDbForTests();
    process.env.USE_MOCKS = "1";
    if (prevKey === undefined) delete process.env.LAB_SECRETS_MASTER_KEY;
    else process.env.LAB_SECRETS_MASTER_KEY = prevKey;
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("listSecrets never returns ciphertext fields", async () => {
    await createSecret({
      name: "test-key",
      category: "api_key",
      value: "super-secret-value",
      actorEmail: "admin@lab.local"
    });

    const rows = await listSecrets();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("test-key");
    expect(rows[0].valueHint).toBe("alue");
    expect(rows[0]).not.toHaveProperty("ciphertext");
  });

  it("decrypts stored value server-side only", async () => {
    const meta = await createSecret({
      name: "hf-token",
      category: "token",
      value: "hf_abc123",
      actorEmail: "admin@lab.local"
    });

    expect(await decryptSecretValue(meta.id)).toBe("hf_abc123");
  });

  it("deleteSecret removes row", async () => {
    const meta = await createSecret({
      name: "temp",
      category: "other",
      value: "x",
      actorEmail: "admin@lab.local"
    });
    await deleteSecret(meta.id, "admin@lab.local");
    expect(await listSecrets()).toHaveLength(0);
  });

  it("updateSecretValue rotates ciphertext and hint", async () => {
    const meta = await createSecret({
      name: "rotate-me",
      category: "token",
      value: "old-value",
      actorEmail: "admin@lab.local"
    });

    const updated = await updateSecretValue({
      id: meta.id,
      value: "new-value-xyz",
      actorEmail: "admin@lab.local"
    });

    expect(updated.valueHint).toBe("-xyz");
    expect(await decryptSecretValue(meta.id)).toBe("new-value-xyz");
  });

  it("updateSecretMeta updates description and k8s sync target", async () => {
    const meta = await createSecret({
      name: "meta-edit",
      category: "api_key",
      value: "secret",
      actorEmail: "admin@lab.local"
    });

    const updated = await updateSecretMeta({
      id: meta.id,
      description: "synced to cluster",
      k8sSync: {
        namespace: "dev",
        secretName: "lab-dev-secret",
        key: "API_KEY"
      },
      actorEmail: "admin@lab.local"
    });

    expect(updated.description).toBe("synced to cluster");
    expect(updated.k8sSync).toEqual({
      namespace: "dev",
      secretName: "lab-dev-secret",
      key: "API_KEY"
    });
    expect(await getSecretMeta(meta.id)).toEqual(updated);
  });

  it("appendAuditEvent records actor and action", async () => {
    const meta = await createSecret({
      name: "audited",
      category: "other",
      value: "v",
      actorEmail: "admin@lab.local"
    });

    await appendAuditEvent(meta.id, "reveal", "viewer@lab.local");

    const events = await getDb().select().from(secretAuditEvents).where(eq(secretAuditEvents.secret_id, meta.id));

    expect(events.some((e) => e.action === "create")).toBe(true);
    expect(events.some((e) => e.action === "reveal" && e.actor_email === "viewer@lab.local")).toBe(true);
  });

  describe("USE_MOCKS=1 short-circuit paths", () => {
    beforeEach(() => {
      process.env.USE_MOCKS = "1";
    });

    it("listSecrets returns fixture metadata", async () => {
      const rows = await listSecrets();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]).not.toHaveProperty("ciphertext");
    });

    it("getSecretMeta finds and misses mock secrets", async () => {
      expect(await getSecretMeta("00000000-0000-4000-8000-000000000001")).not.toBeNull();
      expect(await getSecretMeta("missing-id")).toBeNull();
    });

    it("createSecret returns mock meta without persisting", async () => {
      const meta = await createSecret({
        name: "mock-key",
        category: "token",
        value: "mock-value",
        description: "d",
        k8sSync: { namespace: "dev", secretName: "s", key: "K" },
        actorEmail: "admin@lab.local"
      });
      expect(meta.name).toBe("mock-key");
      expect(meta.k8sSync?.namespace).toBe("dev");
    });

    it("createSecret omits optional mock fields when not provided", async () => {
      const meta = await createSecret({
        name: "mock-minimal",
        category: "other",
        value: "v",
        actorEmail: "admin@lab.local"
      });
      expect(meta.description).toBeNull();
      expect(meta.k8sSync).toBeNull();
    });

    it("updateSecretValue updates mock secret hint", async () => {
      const updated = await updateSecretValue({
        id: "00000000-0000-4000-8000-000000000001",
        value: "new-mock",
        actorEmail: "admin@lab.local"
      });
      expect(updated.valueHint).toBeTruthy();
    });

    it("updateSecretValue throws when mock secret missing", async () => {
      await expect(updateSecretValue({ id: "missing", value: "x", actorEmail: "a" })).rejects.toThrow(/not found/);
    });

    it("updateSecretMeta throws when mock secret missing", async () => {
      await expect(updateSecretMeta({ id: "missing", description: "x", actorEmail: "a" })).rejects.toThrow(/not found/);
    });

    it("deleteSecret throws when mock secret missing", async () => {
      await expect(deleteSecret("missing", "a")).rejects.toThrow(/not found/);
    });

    it("updateSecretMeta keeps existing fields when patches omitted", async () => {
      const updated = await updateSecretMeta({
        id: "00000000-0000-4000-8000-000000000002",
        actorEmail: "admin@lab.local"
      });
      expect(updated.name).toBe("openai-key");
    });

    it("updateSecretMeta patches description and k8s sync in mocks", async () => {
      const updated = await updateSecretMeta({
        id: "00000000-0000-4000-8000-000000000002",
        description: "patched",
        k8sSync: null,
        actorEmail: "admin@lab.local"
      });
      expect(updated.description).toBe("patched");
      expect(updated.k8sSync).toBeNull();
    });

    it("deleteSecret returns mock meta", async () => {
      const deleted = await deleteSecret("00000000-0000-4000-8000-000000000002", "admin@lab.local");
      expect(deleted.name).toBe("openai-key");
    });

    it("decryptSecretValue returns mock plaintext", async () => {
      expect(await decryptSecretValue("any-id")).toBe("mock-secret-value");
    });

    it("appendAuditEvent is a no-op under mocks", async () => {
      await expect(appendAuditEvent("id", "reveal", "a@b.c")).resolves.toBeUndefined();
    });
  });

  it("throws when updateSecretValue finds no row", async () => {
    await expect(
      updateSecretValue({ id: "00000000-0000-0000-0000-000000000000", value: "x", actorEmail: "a" })
    ).rejects.toThrow(/not found/);
  });

  it("throws when updateSecretMeta finds no row", async () => {
    await expect(
      updateSecretMeta({
        id: "00000000-0000-0000-0000-000000000000",
        description: "x",
        actorEmail: "a"
      })
    ).rejects.toThrow(/not found/);
  });

  it("throws when deleteSecret finds no row", async () => {
    await expect(deleteSecret("00000000-0000-0000-0000-000000000000", "a")).rejects.toThrow(/not found/);
  });

  it("throws when decryptSecretValue finds no row", async () => {
    await expect(decryptSecretValue("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/);
  });

  it("rowToMeta returns null k8sSync when columns are partial", async () => {
    const meta = await createSecret({
      name: "partial-k8s",
      category: "api_key",
      value: "v",
      actorEmail: "admin@lab.local"
    });

    await getDb()
      .update(labSecrets)
      .set({ k8s_sync_namespace: "dev", k8s_sync_secret_name: null, k8s_sync_key: null })
      .where(eq(labSecrets.id, meta.id));

    const listed = await listSecrets();
    expect(listed.find((s) => s.id === meta.id)?.k8sSync).toBeNull();
  });

  it("getSecretMeta returns null for missing database row", async () => {
    expect(await getSecretMeta("00000000-0000-0000-0000-000000000099")).toBeNull();
  });

  it("createSecret stores without optional description", async () => {
    const meta = await createSecret({
      name: "no-desc",
      category: "other",
      value: "v",
      actorEmail: "admin@lab.local"
    });
    expect(meta.description).toBeNull();
  });

  it("updateSecretMeta can patch only description", async () => {
    const meta = await createSecret({
      name: "desc-only",
      category: "api_key",
      value: "v",
      actorEmail: "admin@lab.local"
    });
    const updated = await updateSecretMeta({
      id: meta.id,
      description: "only-desc",
      actorEmail: "admin@lab.local"
    });
    expect(updated.description).toBe("only-desc");
  });

  it("updateSecretMeta can clear k8s sync without changing description", async () => {
    const meta = await createSecret({
      name: "clear-k8s",
      category: "api_key",
      value: "v",
      k8sSync: { namespace: "dev", secretName: "s", key: "K" },
      actorEmail: "admin@lab.local"
    });
    const updated = await updateSecretMeta({
      id: meta.id,
      k8sSync: null,
      actorEmail: "admin@lab.local"
    });
    expect(updated.k8sSync).toBeNull();
    expect(updated.description).toBe(meta.description);
  });

  it("createSecret stores k8s sync columns", async () => {
    const meta = await createSecret({
      name: "k8s-synced",
      category: "api_key",
      value: "sync-value",
      k8sSync: {
        namespace: "ai-inference",
        secretName: "lab-sync",
        key: "TOKEN"
      },
      actorEmail: "admin@lab.local"
    });

    expect(meta.k8sSync).toEqual({
      namespace: "ai-inference",
      secretName: "lab-sync",
      key: "TOKEN"
    });
  });
});
