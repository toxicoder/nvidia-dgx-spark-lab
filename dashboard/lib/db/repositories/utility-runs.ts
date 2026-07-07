import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { utilityRuns, type UtilityRun } from "@/lib/db/schema";
import { truncateOutput } from "@/lib/format";

/** Persist and query utility script run history (no-op when `USE_MOCKS=1`). */

export async function recordUtilityRun(input: {
  name: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}): Promise<void> {
  if (process.env.USE_MOCKS === "1") return;

  const status = input.exitCode === 0 ? "success" : input.exitCode === 2 ? "noop" : "error";
  const output = truncateOutput([input.stdout, input.stderr].filter(Boolean).join("\n").trim());

  await db.insert(utilityRuns).values({
    name: input.name,
    status,
    started_at: Math.floor(Date.now() / 1000),
    output: output || null,
    exit_code: input.exitCode
  });
}

/** Return the most recent utility run row for a script name. */
export async function getLatestUtilityRun(name: string): Promise<UtilityRun | undefined> {
  if (process.env.USE_MOCKS === "1") return undefined;

  try {
    const rows = await db
      .select()
      .from(utilityRuns)
      .where(eq(utilityRuns.name, name))
      .orderBy(desc(utilityRuns.id))
      .limit(1);

    return rows[0];
  } catch {
    return undefined;
  }
}

/** Latest run per utility name in a single query. */
export async function getLatestUtilityRunsByName(names: string[]): Promise<Map<string, UtilityRun>> {
  const result = new Map<string, UtilityRun>();
  if (process.env.USE_MOCKS === "1" || names.length === 0) return result;

  const rows = await db
    .select()
    .from(utilityRuns)
    .where(inArray(utilityRuns.name, names))
    .orderBy(desc(utilityRuns.id));

  for (const row of rows) {
    if (!result.has(row.name)) {
      result.set(row.name, row);
    }
  }
  return result;
}

/** List recent utility runs across all scripts for the utilities panel. */
export async function listRecentUtilityRuns(limit = 20): Promise<UtilityRun[]> {
  if (process.env.USE_MOCKS === "1") return [];

  return db.select().from(utilityRuns).orderBy(desc(utilityRuns.id)).limit(limit);
}
