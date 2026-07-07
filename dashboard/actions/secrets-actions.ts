/**
 * Encrypted secrets vault actions: CRUD, reveal (audited), and optional K8s sync.
 *
 * Thin wrappers around `@/lib/db/repositories/lab-secrets` and `@/lib/services/k8s-secrets`.
 * Requires {@link requireSessionUser}; plaintext values never returned in list views.
 */
"use server";

import { revalidatePath } from "next/cache";
import {
  appendAuditEvent,
  createSecret,
  decryptSecretValue,
  deleteSecret,
  getSecretMeta,
  listSecrets,
  updateSecretMeta,
  updateSecretValue
} from "@/lib/db/repositories/lab-secrets";
import { removeK8sSecretKey, syncSecretToK8s } from "@/lib/services/k8s-secrets";
import { requireSessionUser } from "@/lib/require-session";
import {
  CreateSecretSchema,
  DeleteSecretSchema,
  RevealSecretSchema,
  SyncSecretSchema,
  UpdateSecretMetaSchema,
  UpdateSecretValueSchema
} from "@/lib/validation";
import type { K8sSyncTarget, LabSecretMeta } from "@/lib/types";

async function maybeSyncToK8s(meta: LabSecretMeta, plaintext: string, actorEmail: string): Promise<string | null> {
  if (!meta.k8sSync) return null;
  const result = await syncSecretToK8s(meta.k8sSync, plaintext);
  if (result.ok) {
    await appendAuditEvent(meta.id, "k8s_sync", actorEmail);
    return null;
  }
  return result.error ?? "K8s sync failed";
}

/**
 * List all lab secrets (metadata only — no plaintext values).
 * @returns Array of {@link LabSecretMeta} records.
 * @throws When session is missing.
 */
export async function listSecretsAction(): Promise<LabSecretMeta[]> {
  await requireSessionUser();
  return listSecrets();
}

/**
 * Create a new encrypted secret with optional K8s sync.
 * @param input - Payload validated by {@link CreateSecretSchema}.
 * @returns Created metadata and optional sync error message.
 * @throws When session is missing or input fails validation.
 */
export async function createSecretAction(input: unknown): Promise<{ meta: LabSecretMeta; syncError?: string }> {
  const user = await requireSessionUser();
  const parsed = CreateSecretSchema.parse(input);

  const meta = await createSecret({
    name: parsed.name,
    category: parsed.category,
    value: parsed.value,
    description: parsed.description,
    k8sSync: parsed.k8sSync,
    actorEmail: user.email
  });

  const syncError = await maybeSyncToK8s(meta, parsed.value, user.email);
  revalidatePath("/");
  return { meta, syncError: syncError ?? undefined };
}

/**
 * Update a secret's plaintext value (re-encrypts and optionally re-syncs to K8s).
 * @param input - Payload validated by {@link UpdateSecretValueSchema}.
 * @returns Updated metadata and optional sync error message.
 * @throws When session is missing or input fails validation.
 */
export async function updateSecretValueAction(input: unknown): Promise<{ meta: LabSecretMeta; syncError?: string }> {
  const user = await requireSessionUser();
  const parsed = UpdateSecretValueSchema.parse(input);

  const meta = await updateSecretValue({
    id: parsed.id,
    value: parsed.value,
    actorEmail: user.email
  });

  const syncError = await maybeSyncToK8s(meta, parsed.value, user.email);
  revalidatePath("/");
  return { meta, syncError: syncError ?? undefined };
}

/**
 * Update secret description and/or K8s sync target (no value change).
 * @param input - Payload validated by {@link UpdateSecretMetaSchema}.
 * @returns Updated {@link LabSecretMeta}.
 * @throws When session is missing or input fails validation.
 */
export async function updateSecretMetaAction(input: unknown): Promise<LabSecretMeta> {
  const user = await requireSessionUser();
  const parsed = UpdateSecretMetaSchema.parse(input);

  const meta = await updateSecretMeta({
    id: parsed.id,
    description: parsed.description,
    k8sSync: parsed.k8sSync,
    actorEmail: user.email
  });

  revalidatePath("/");
  return meta;
}

/**
 * Delete a secret after explicit confirmation.
 * @param input - Payload validated by {@link DeleteSecretSchema} (`confirm: "DELETE"`).
 * @returns Resolves when the secret (and optional K8s key) is removed.
 * @throws When session is missing, secret not found, or input fails validation.
 */
export async function deleteSecretAction(input: unknown): Promise<void> {
  const user = await requireSessionUser();
  const parsed = DeleteSecretSchema.parse(input);

  const meta = await deleteSecret(parsed.id, user.email);

  if (meta.k8sSync) {
    await removeK8sSecretKey(meta.k8sSync);
  }

  revalidatePath("/");
}

/**
 * Reveal a secret's plaintext value (audited).
 * @param input - Payload validated by {@link RevealSecretSchema} (`confirm: "REVEAL"`).
 * @returns Decrypted plaintext value.
 * @throws When session is missing, secret not found, or input fails validation.
 */
export async function revealSecretAction(input: unknown): Promise<string> {
  const user = await requireSessionUser();
  const parsed = RevealSecretSchema.parse(input);

  const meta = await getSecretMeta(parsed.id);
  if (!meta) throw new Error("Secret not found");

  await appendAuditEvent(parsed.id, "reveal", user.email);
  return decryptSecretValue(parsed.id);
}

/**
 * Manually sync a secret's current value to its configured K8s target.
 * @param input - Payload validated by {@link SyncSecretSchema}.
 * @returns `{ ok: true }` on success or `{ ok: false, error }` on kubectl failure.
 * @throws When session is missing, secret not found, or no K8s sync target configured.
 */
export async function syncSecretToK8sAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSessionUser();
  const parsed = SyncSecretSchema.parse(input);

  const meta = await getSecretMeta(parsed.id);
  if (!meta) throw new Error("Secret not found");
  if (!meta.k8sSync) throw new Error("Secret has no K8s sync target configured");

  const plaintext = await decryptSecretValue(parsed.id);
  const result = await syncSecretToK8s(meta.k8sSync as K8sSyncTarget, plaintext);

  if (result.ok) {
    await appendAuditEvent(parsed.id, "k8s_sync", user.email);
  }

  return result;
}
