import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, resetDbForTests } from "@/lib/db";
import {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations
} from "@/lib/db/auth-schema";

describe("auth-schema", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `auth-schema-${Date.now()}.db`);
    resetDbForTests(dbPath);
    process.env.USE_MOCKS = "0";
    migrate(getDb(), {
      migrationsFolder: path.join(__dirname, "../migrations")
    });
  });

  afterEach(() => {
    resetDbForTests();
    process.env.USE_MOCKS = "1";
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("exports relation graphs for drizzle queries", () => {
    expect(userRelations).toBeDefined();
    expect(sessionRelations).toBeDefined();
    expect(accountRelations).toBeDefined();
  });

  it("supports insert and update with onUpdate timestamps", async () => {
    const db = getDb();
    const userId = "user-1";
    const now = Date.now();

    await db.insert(user).values({
      id: userId,
      name: "Admin",
      email: "admin@lab.local",
      emailVerified: true,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    });

    await db.insert(session).values({
      id: "sess-1",
      expiresAt: new Date(now + 60_000),
      token: "token-1",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      userId
    });

    await db.insert(account).values({
      id: "acct-1",
      accountId: "local",
      providerId: "credential",
      userId,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    });

    await db.insert(verification).values({
      id: "ver-1",
      identifier: "admin@lab.local",
      value: "code",
      expiresAt: new Date(now + 60_000),
      createdAt: new Date(now),
      updatedAt: new Date(now)
    });

    const beforeSession = (await db.select().from(session).where(eq(session.id, "sess-1")))[0]?.updatedAt;
    const beforeAccount = (await db.select().from(account).where(eq(account.id, "acct-1")))[0]?.updatedAt;

    await db.update(user).set({ name: "Admin Updated" }).where(eq(user.id, userId));
    await db.update(session).set({ ipAddress: "127.0.0.1" }).where(eq(session.id, "sess-1"));
    await db.update(account).set({ scope: "openid" }).where(eq(account.id, "acct-1"));
    await db.update(verification).set({ value: "code2" }).where(eq(verification.id, "ver-1"));

    const rows = await db.select().from(user).where(eq(user.id, userId));
    expect(rows[0]?.name).toBe("Admin Updated");

    const sessionRow = (await db.select().from(session).where(eq(session.id, "sess-1")))[0];
    const accountRow = (await db.select().from(account).where(eq(account.id, "acct-1")))[0];
    expect(sessionRow?.ipAddress).toBe("127.0.0.1");
    expect(accountRow?.scope).toBe("openid");
    expect(sessionRow?.updatedAt).not.toEqual(beforeSession);
    expect(accountRow?.updatedAt).not.toEqual(beforeAccount);
  });
});
