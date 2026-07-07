import path from "path";

const WHITELIST_BASES = (process.env.LAB_WHITELIST_BASES || "/mnt/models,/home,/tmp/lab-trash").split(",");

function isUnderBase(resolved: string, base: string): boolean {
  const resolvedBase = path.resolve(base);
  return resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep);
}

/** Whether a target path is within configured LAB_WHITELIST_BASES. */
export function isPathAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return WHITELIST_BASES.some((base) => isUnderBase(resolved, base));
}
