/**
 * Clipboard helpers for the operator dashboard.
 *
 * Every caller used to fire `navigator.clipboard.writeText(url)` without awaiting
 * and toast success anyway, which reports a copy that never happened whenever the
 * page is not a secure origin or the permission is denied. The clear side was worse:
 * SecretsPanel wiped the clipboard unconditionally after 30 s, destroying whatever
 * the operator had copied in the meantime. Both directions are verified here.
 */

/** The clipboard is absent on a non-secure origin, and absent under some browsers. */
function clipboard(): Clipboard | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

/**
 * Write `text` to the system clipboard and report whether it actually landed.
 * @param text - The value to copy.
 * @returns `true` only when the write resolved without throwing.
 */
export async function copyText(text: string): Promise<boolean> {
  const clip = clipboard();
  if (!clip?.writeText) return false;
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the clipboard, but only while it still holds the value we put there.
 *
 * Reading first is what makes this safe: an unconditional `writeText("")` destroys
 * anything the operator copied after us (a password-manager entry, a shell command)
 * and the UI has no way to know.
 * @param expected - The value we copied; the wipe happens only on an exact match.
 * @returns `true` when the clipboard was cleared, `false` when it was left alone.
 */
export async function clearCopiedText(expected: string): Promise<boolean> {
  const clip = clipboard();
  if (!clip?.writeText || !clip.readText) return false;

  let current: string;
  try {
    current = await clip.readText();
  } catch {
    return false;
  }
  if (current !== expected) return false;

  try {
    await clip.writeText("");
    return true;
  } catch {
    return false;
  }
}
