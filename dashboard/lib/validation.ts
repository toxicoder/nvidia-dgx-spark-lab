/**
 * Zod validation schemas for server actions and service inputs.
 *
 * Centralizes allowlists (utilities, paths, model names, stack ids) so actions
 * reject malformed input before shell or kubectl invocation. Schemas are shared
 * between `actions/*` and `lib/services/*`.
 */
import { z } from "zod";
import { isPathAllowed } from "@/lib/path-security";
import { ALLOWED_UTILITIES } from "@/lib/allowed-utilities";
import { INFERENCE_MODEL_NAMES, NEMOTRON_STACK_IDS } from "@/lib/types";

/** Docker container ID / name (safe chars only). */
export const ContainerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,127}$/i);

/** Filesystem path constrained to lab whitelist bases. */
export const PathSchema = z
  .object({ path: z.string().min(1) })
  .refine(({ path }) => isPathAllowed(path), "Path not allowed");

/** Lab utility script name (must be in {@link ALLOWED_UTILITIES}). */
export const UtilityNameSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .refine((name) => ALLOWED_UTILITIES.has(name), "Utility not allowed");

/** Dev workspace identifier (`coder` or `kasm`). */
export const DevWorkspaceNameSchema = z.enum(["coder", "kasm"]);

/**
 * Inference model id allowlist for workload start/stop.
 *
 * Derived from {@link INFERENCE_MODEL_NAMES}, the single source of truth shared
 * with the `InferenceModelName` type. Listing the names twice let the runtime
 * check and the compile-time type drift.
 */
export const InferenceModelNameSchema = z.enum(INFERENCE_MODEL_NAMES);

/** Nemotron agentic stack id allowlist; derived from {@link NEMOTRON_STACK_IDS}. */
export const NemotronStackIdSchema = z.enum(NEMOTRON_STACK_IDS);

/** Resource Guard action token (`model:…`, `stack:…`, or `dev:…`). */
export const CapacityActionSchema = z
  .string()
  .regex(/^(model:[a-z0-9.-]+|stack:(nemotron-agentic|qwen-agentic|qwen36-dual)-[a-z0-9-]+|dev:(coder|kasm))$/);

/** Heavy model/stack confirmation literal required before start. */
export const HeavyConfirmSchema = z.literal("yes");

/** Open WebUI stack id allowlist. */
export const OpenWebUIStackIdSchema = z.enum(["open-webui-lab"]);

/** Lab secret name (DNS-like, lowercase). */
export const SecretNameSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

/** Secret category for UI grouping and audit. */
export const SecretCategorySchema = z.enum(["api_key", "token", "password", "other"]);

/** Secret plaintext value (1–8192 chars). */
export const SecretValueSchema = z.string().min(1).max(8192);

/** Secret record UUID primary key. */
export const SecretIdSchema = z.string().uuid();

/** K8s Secret sync target (namespace, secret name, key). */
export const K8sSyncTargetSchema = z.object({
  namespace: z.enum(["dev", "ai-inference"]),
  secretName: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,252}$/),
  key: z.string().regex(/^[A-Z_][A-Z0-9_]{0,62}$/)
});

/** Payload for creating a new lab secret. */
export const CreateSecretSchema = z.object({
  name: SecretNameSchema,
  category: SecretCategorySchema,
  value: SecretValueSchema,
  description: z.string().max(512).optional(),
  k8sSync: K8sSyncTargetSchema.optional()
});

/** Payload for updating a secret's plaintext value. */
export const UpdateSecretValueSchema = z.object({
  id: SecretIdSchema,
  value: SecretValueSchema
});

/** Payload for updating secret metadata (description, K8s sync). */
export const UpdateSecretMetaSchema = z.object({
  id: SecretIdSchema,
  description: z.string().max(512).nullable().optional(),
  k8sSync: K8sSyncTargetSchema.nullable().optional()
});

/** Payload for deleting a secret (requires `confirm: "DELETE"`). */
export const DeleteSecretSchema = z.object({
  id: SecretIdSchema,
  confirm: z.literal("DELETE")
});

/** Payload for revealing a secret (requires `confirm: "REVEAL"`). */
export const RevealSecretSchema = z.object({
  id: SecretIdSchema,
  confirm: z.literal("REVEAL")
});

/** Payload for manually syncing a secret to K8s. */
export const SyncSecretSchema = z.object({
  id: SecretIdSchema
});

export { RelativeRedirectSchema } from "@/lib/redirect";
