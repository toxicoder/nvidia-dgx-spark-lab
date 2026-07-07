/**
 * AES-256-GCM encryption for the dashboard secrets vault.
 * Master key from `LAB_SECRETS_MASTER_KEY` (32-byte base64); dev-only scrypt fallback otherwise.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getMasterKey(): Buffer {
  const raw = process.env.LAB_SECRETS_MASTER_KEY;
  if (!raw) {
    const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (process.env.NODE_ENV === "production" && !isNextBuild && process.env.VISUAL_TEST !== "1") {
      throw new Error("LAB_SECRETS_MASTER_KEY is required when NODE_ENV=production");
    }
    return scryptSync("lab-secrets-dev-only-not-for-production", "lab-secrets-v1", 32);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("LAB_SECRETS_MASTER_KEY must decode to exactly 32 bytes (base64)");
  }
  return buf;
}

/** AES-256-GCM encrypt; stored as base64(iv ‖ authTag ‖ ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt blob produced by {@link encryptSecret}. Throws on tamper or wrong key. */
export function decryptSecret(blob: string): string {
  const key = getMasterKey();
  const data = Buffer.from(blob, "base64");
  if (data.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid ciphertext");
  }
  const iv = data.subarray(0, IV_LEN);
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = data.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Last four characters for masked display (write-only list views). */
export function valueHint(value: string): string {
  if (value.length <= 4) return "••••";
  return value.slice(-4);
}
