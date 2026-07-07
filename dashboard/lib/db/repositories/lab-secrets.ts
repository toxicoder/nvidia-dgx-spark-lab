/** SQLite-backed lab secrets vault with encrypted values and audit events. */

import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { labSecrets, secretAuditEvents } from "@/lib/db/schema";
import { decryptSecret, encryptSecret, valueHint } from "@/lib/crypto/secrets";
import { fakeSecrets } from "@/lib/mocks/fixtures";
import type { K8sSyncTarget, LabSecretMeta, SecretAuditAction, SecretCategory } from "@/lib/types";

function nowMs(): number {
  return Date.now();
}

function rowToMeta(row: typeof labSecrets.$inferSelect): LabSecretMeta {
  const k8sSync =
    row.k8s_sync_namespace && row.k8s_sync_secret_name && row.k8s_sync_key
      ? {
          namespace: row.k8s_sync_namespace as K8sSyncTarget["namespace"],
          secretName: row.k8s_sync_secret_name,
          key: row.k8s_sync_key
        }
      : null;

  return {
    id: row.id,
    name: row.name,
    category: row.category as SecretCategory,
    description: row.description,
    valueHint: row.value_hint,
    k8sSync,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by
  };
}

/** Record a secrets vault audit event for the given actor. */
export async function appendAuditEvent(
  secretId: string | null,
  action: SecretAuditAction,
  actorEmail: string
): Promise<void> {
  if (process.env.USE_MOCKS === "1") return;

  await db.insert(secretAuditEvents).values({
    secret_id: secretId,
    action,
    actor_email: actorEmail,
    created_at: nowMs()
  });
}

/** List secret metadata without decrypted values. */
export async function listSecrets(): Promise<LabSecretMeta[]> {
  if (process.env.USE_MOCKS === "1") return fakeSecrets;

  const rows = await db.select().from(labSecrets).orderBy(desc(labSecrets.updated_at));
  return rows.map(rowToMeta);
}

/** Fetch secret metadata by id without returning the encrypted value. */
export async function getSecretMeta(id: string): Promise<LabSecretMeta | null> {
  if (process.env.USE_MOCKS === "1") {
    return fakeSecrets.find((s) => s.id === id) ?? null;
  }

  const rows = await db.select().from(labSecrets).where(eq(labSecrets.id, id)).limit(1);
  return rows[0] ? rowToMeta(rows[0]) : null;
}

/** Create a new encrypted secret and record a create audit event. */
export async function createSecret(input: {
  name: string;
  category: SecretCategory;
  value: string;
  description?: string;
  k8sSync?: K8sSyncTarget;
  actorEmail: string;
}): Promise<LabSecretMeta> {
  if (process.env.USE_MOCKS === "1") {
    const meta: LabSecretMeta = {
      id: randomUUID(),
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      valueHint: valueHint(input.value),
      k8sSync: input.k8sSync ?? null,
      createdAt: nowMs(),
      updatedAt: nowMs(),
      createdBy: input.actorEmail
    };
    return meta;
  }

  const ts = nowMs();
  const id = randomUUID();
  const ciphertext = encryptSecret(input.value);

  await db.insert(labSecrets).values({
    id,
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    ciphertext,
    value_hint: valueHint(input.value),
    k8s_sync_namespace: input.k8sSync?.namespace ?? null,
    k8s_sync_secret_name: input.k8sSync?.secretName ?? null,
    k8s_sync_key: input.k8sSync?.key ?? null,
    created_at: ts,
    updated_at: ts,
    created_by: input.actorEmail
  });

  await appendAuditEvent(id, "create", input.actorEmail);
  const meta = await getSecretMeta(id);
  return meta!;
}

/** Rotate the encrypted value for an existing secret. */
export async function updateSecretValue(input: {
  id: string;
  value: string;
  actorEmail: string;
}): Promise<LabSecretMeta> {
  if (process.env.USE_MOCKS === "1") {
    const existing = fakeSecrets.find((s) => s.id === input.id);
    if (!existing) throw new Error("Secret not found");
    return { ...existing, valueHint: valueHint(input.value), updatedAt: nowMs() };
  }

  const ciphertext = encryptSecret(input.value);
  const ts = nowMs();

  const updated = await db
    .update(labSecrets)
    .set({
      ciphertext,
      value_hint: valueHint(input.value),
      updated_at: ts
    })
    .where(eq(labSecrets.id, input.id))
    .returning({ id: labSecrets.id });

  if (!updated.length) throw new Error("Secret not found");

  await appendAuditEvent(input.id, "update_value", input.actorEmail);
  const meta = await getSecretMeta(input.id);
  return meta!;
}

/** Update non-value secret metadata such as description or K8s sync target. */
export async function updateSecretMeta(input: {
  id: string;
  description?: string | null;
  k8sSync?: K8sSyncTarget | null;
  actorEmail: string;
}): Promise<LabSecretMeta> {
  if (process.env.USE_MOCKS === "1") {
    const existing = fakeSecrets.find((s) => s.id === input.id);
    if (!existing) throw new Error("Secret not found");
    return {
      ...existing,
      description: input.description !== undefined ? input.description : existing.description,
      k8sSync: input.k8sSync !== undefined ? input.k8sSync : existing.k8sSync,
      updatedAt: nowMs()
    };
  }

  const patch: Partial<typeof labSecrets.$inferInsert> = { updated_at: nowMs() };
  if (input.description !== undefined) patch.description = input.description;
  if (input.k8sSync !== undefined) {
    patch.k8s_sync_namespace = input.k8sSync?.namespace ?? null;
    patch.k8s_sync_secret_name = input.k8sSync?.secretName ?? null;
    patch.k8s_sync_key = input.k8sSync?.key ?? null;
  }

  const updated = await db.update(labSecrets).set(patch).where(eq(labSecrets.id, input.id)).returning({
    id: labSecrets.id
  });

  if (!updated.length) throw new Error("Secret not found");

  await appendAuditEvent(input.id, "update_meta", input.actorEmail);
  const meta = await getSecretMeta(input.id);
  return meta!;
}

/** Delete a secret and record a delete audit event. */
export async function deleteSecret(id: string, actorEmail: string): Promise<LabSecretMeta> {
  if (process.env.USE_MOCKS === "1") {
    const existing = fakeSecrets.find((s) => s.id === id);
    if (!existing) throw new Error("Secret not found");
    return existing;
  }

  const rows = await db.select().from(labSecrets).where(eq(labSecrets.id, id)).limit(1);
  if (!rows[0]) throw new Error("Secret not found");

  const meta = rowToMeta(rows[0]);
  await db.delete(labSecrets).where(eq(labSecrets.id, id));
  await appendAuditEvent(id, "delete", actorEmail);
  return meta;
}

/** Decrypt stored value — server-only; never expose via list APIs. */
export async function decryptSecretValue(id: string): Promise<string> {
  if (process.env.USE_MOCKS === "1") return "mock-secret-value";

  const rows = await db.select().from(labSecrets).where(eq(labSecrets.id, id)).limit(1);
  if (!rows[0]) throw new Error("Secret not found");
  return decryptSecret(rows[0].ciphertext);
}
