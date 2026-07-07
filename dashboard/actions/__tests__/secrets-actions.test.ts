import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LabSecretMeta } from "@/lib/types";

const { mockMeta, mockMetaWithK8s } = vi.hoisted(() => {
  const meta: LabSecretMeta = {
    id: "00000000-0000-4000-8000-000000000099",
    name: "test",
    category: "api_key",
    description: null,
    valueHint: "1234",
    k8sSync: null,
    createdAt: 1,
    updatedAt: 1,
    createdBy: "admin@lab.local"
  };
  return {
    mockMeta: meta,
    mockMetaWithK8s: {
      ...meta,
      k8sSync: {
        namespace: "ai-inference" as const,
        secretName: "lab-hf-token",
        key: "HF_TOKEN"
      }
    }
  };
});

vi.mock("@/lib/require-session", () => ({
  requireSessionUser: vi.fn().mockResolvedValue({ id: "u1", email: "admin@lab.local" }),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
}));

vi.mock("@/lib/db/repositories/lab-secrets", () => ({
  listSecrets: vi.fn().mockResolvedValue([mockMeta]),
  createSecret: vi.fn().mockResolvedValue(mockMeta),
  updateSecretValue: vi.fn().mockResolvedValue(mockMeta),
  updateSecretMeta: vi.fn().mockResolvedValue(mockMeta),
  deleteSecret: vi.fn().mockResolvedValue(mockMeta),
  getSecretMeta: vi.fn().mockResolvedValue(mockMetaWithK8s),
  decryptSecretValue: vi.fn().mockResolvedValue("revealed"),
  appendAuditEvent: vi.fn()
}));

vi.mock("@/lib/services/k8s-secrets", () => ({
  syncSecretToK8s: vi.fn().mockResolvedValue({ ok: true }),
  removeK8sSecretKey: vi.fn().mockResolvedValue({ ok: true })
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

import {
  createSecretAction,
  deleteSecretAction,
  listSecretsAction,
  revealSecretAction,
  syncSecretToK8sAction,
  updateSecretMetaAction,
  updateSecretValueAction
} from "../secrets-actions";
import {
  appendAuditEvent,
  createSecret,
  deleteSecret,
  getSecretMeta,
  listSecrets,
  updateSecretMeta,
  updateSecretValue
} from "@/lib/db/repositories/lab-secrets";
import { removeK8sSecretKey, syncSecretToK8s } from "@/lib/services/k8s-secrets";
import { revalidatePath } from "next/cache";

describe("secrets-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSecret).mockResolvedValue(mockMeta);
    vi.mocked(updateSecretValue).mockResolvedValue(mockMeta);
    vi.mocked(updateSecretMeta).mockResolvedValue(mockMeta);
    vi.mocked(deleteSecret).mockResolvedValue(mockMeta);
    vi.mocked(getSecretMeta).mockResolvedValue(mockMetaWithK8s);
    vi.mocked(syncSecretToK8s).mockResolvedValue({ ok: true });
  });

  it("listSecretsAction returns repository rows", async () => {
    const rows = await listSecretsAction();
    expect(rows).toEqual([mockMeta]);
    expect(listSecrets).toHaveBeenCalled();
  });

  it("createSecretAction rejects invalid names", async () => {
    await expect(createSecretAction({ name: "BAD NAME", category: "api_key", value: "x" })).rejects.toThrow();
  });

  it("createSecretAction stores encrypted secret", async () => {
    const result = await createSecretAction({
      name: "hf-token",
      category: "api_key",
      value: "hf_test"
    });
    expect(result.meta.name).toBe("test");
    expect(createSecret).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("createSecretAction returns k8s sync error on create", async () => {
    vi.mocked(createSecret).mockResolvedValue(mockMetaWithK8s);
    vi.mocked(syncSecretToK8s).mockResolvedValue({ ok: false, error: "kubectl apply failed" });

    const result = await createSecretAction({
      name: "hf-token",
      category: "api_key",
      value: "hf_test",
      k8sSync: mockMetaWithK8s.k8sSync!
    });

    expect(result.syncError).toBe("kubectl apply failed");
    expect(syncSecretToK8s).toHaveBeenCalledWith(mockMetaWithK8s.k8sSync, "hf_test");
    expect(appendAuditEvent).not.toHaveBeenCalled();
  });

  it("updateSecretValueAction updates value and revalidates", async () => {
    const result = await updateSecretValueAction({
      id: "00000000-0000-4000-8000-000000000099",
      value: "new-value"
    });
    expect(result.meta).toEqual(mockMeta);
    expect(updateSecretValue).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000099",
      value: "new-value",
      actorEmail: "admin@lab.local"
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("updateSecretMetaAction updates metadata", async () => {
    const meta = await updateSecretMetaAction({
      id: "00000000-0000-4000-8000-000000000099",
      description: "updated"
    });
    expect(meta).toEqual(mockMeta);
    expect(updateSecretMeta).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000099",
      description: "updated",
      actorEmail: "admin@lab.local"
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("syncSecretToK8sAction decrypts and syncs", async () => {
    const result = await syncSecretToK8sAction({ id: "00000000-0000-4000-8000-000000000099" });
    expect(result).toEqual({ ok: true });
    expect(syncSecretToK8s).toHaveBeenCalledWith(mockMetaWithK8s.k8sSync, "revealed");
    expect(appendAuditEvent).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000099",
      "k8s_sync",
      "admin@lab.local"
    );
  });

  it("syncSecretToK8sAction throws when secret missing", async () => {
    vi.mocked(getSecretMeta).mockResolvedValue(null);
    await expect(syncSecretToK8sAction({ id: "00000000-0000-4000-8000-000000000099" })).rejects.toThrow(
      /Secret not found/
    );
  });

  it("syncSecretToK8sAction throws when no k8s target", async () => {
    vi.mocked(getSecretMeta).mockResolvedValue(mockMeta);
    await expect(syncSecretToK8sAction({ id: "00000000-0000-4000-8000-000000000099" })).rejects.toThrow(
      /no K8s sync target/
    );
  });

  it("deleteSecretAction requires DELETE confirm", async () => {
    await expect(deleteSecretAction({ id: "00000000-0000-4000-8000-000000000001", confirm: "NOPE" })).rejects.toThrow();
  });

  it("deleteSecretAction removes secret and k8s key on success", async () => {
    vi.mocked(deleteSecret).mockResolvedValue(mockMetaWithK8s);

    await deleteSecretAction({
      id: "00000000-0000-4000-8000-000000000099",
      confirm: "DELETE"
    });

    expect(deleteSecret).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000099", "admin@lab.local");
    expect(removeK8sSecretKey).toHaveBeenCalledWith(mockMetaWithK8s.k8sSync);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("revealSecretAction requires REVEAL confirm", async () => {
    await expect(revealSecretAction({ id: "00000000-0000-4000-8000-000000000001", confirm: "NOPE" })).rejects.toThrow();
  });

  it("revealSecretAction returns decrypted value and audits", async () => {
    const value = await revealSecretAction({
      id: "00000000-0000-4000-8000-000000000099",
      confirm: "REVEAL"
    });
    expect(value).toBe("revealed");
    expect(appendAuditEvent).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000099", "reveal", "admin@lab.local");
  });

  it("revealSecretAction throws when secret missing", async () => {
    vi.mocked(getSecretMeta).mockResolvedValue(null);
    await expect(revealSecretAction({ id: "00000000-0000-4000-8000-000000000099", confirm: "REVEAL" })).rejects.toThrow(
      /Secret not found/
    );
  });

  it("updateSecretValueAction audits successful k8s sync", async () => {
    vi.mocked(updateSecretValue).mockResolvedValue(mockMetaWithK8s);
    await updateSecretValueAction({
      id: "00000000-0000-4000-8000-000000000099",
      value: "synced"
    });
    expect(appendAuditEvent).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000099",
      "k8s_sync",
      "admin@lab.local"
    );
  });

  it("createSecretAction skips k8s sync when meta has no target", async () => {
    const result = await createSecretAction({
      name: "local-only",
      category: "api_key",
      value: "secret"
    });
    expect(result.syncError).toBeUndefined();
    expect(syncSecretToK8s).not.toHaveBeenCalled();
  });

  it("createSecretAction uses default sync error message", async () => {
    vi.mocked(createSecret).mockResolvedValue(mockMetaWithK8s);
    vi.mocked(syncSecretToK8s).mockResolvedValue({ ok: false });

    const result = await createSecretAction({
      name: "hf-token",
      category: "api_key",
      value: "hf_test",
      k8sSync: mockMetaWithK8s.k8sSync!
    });

    expect(result.syncError).toBe("K8s sync failed");
  });

  it("deleteSecretAction skips k8s removal when secret has no sync target", async () => {
    await deleteSecretAction({
      id: "00000000-0000-4000-8000-000000000099",
      confirm: "DELETE"
    });
    expect(removeK8sSecretKey).not.toHaveBeenCalled();
  });

  it("syncSecretToK8sAction skips audit when sync fails", async () => {
    vi.mocked(syncSecretToK8s).mockResolvedValue({ ok: false, error: "denied" });
    const result = await syncSecretToK8sAction({ id: "00000000-0000-4000-8000-000000000099" });
    expect(result).toEqual({ ok: false, error: "denied" });
    expect(appendAuditEvent).not.toHaveBeenCalled();
  });
});
