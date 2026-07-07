/**
 * Shared hoisted mocks for service real-path tests (USE_MOCKS=0).
 * Import this module before the service under test in each __tests__ file.
 */
import { vi } from "vitest";

type ServiceMocks = {
  execAsync: ReturnType<typeof vi.fn>;
  execFileAsync: ReturnType<typeof vi.fn>;
  existsSync: ReturnType<typeof vi.fn>;
  readdirSync: ReturnType<typeof vi.fn>;
  fsMkdtemp: ReturnType<typeof vi.fn>;
  fsWriteFile: ReturnType<typeof vi.fn>;
  fsRm: ReturnType<typeof vi.fn>;
  mockExec: ReturnType<typeof vi.fn>;
  mockExecFile: ReturnType<typeof vi.fn>;
};

declare global {
  var __dashboardServiceMocks: ServiceMocks | undefined;
}

vi.hoisted(() => {
  const execAsync = vi.fn();
  const execFileAsync = vi.fn();
  const existsSync = vi.fn();
  const readdirSync = vi.fn();
  const fsMkdtemp = vi.fn();
  const fsWriteFile = vi.fn();
  const fsRm = vi.fn();

  const mockExec = vi.fn();
  Object.defineProperty(mockExec, "name", { value: "exec" });
  const mockExecFile = vi.fn();
  Object.defineProperty(mockExecFile, "name", { value: "execFile" });

  globalThis.__dashboardServiceMocks = {
    execAsync,
    execFileAsync,
    existsSync,
    readdirSync,
    fsMkdtemp,
    fsWriteFile,
    fsRm,
    mockExec,
    mockExecFile
  };
});

function m(): ServiceMocks {
  return globalThis.__dashboardServiceMocks!;
}

function promisifyMock(fn: { name?: string }) {
  if (fn?.name === "execFile") return m().execFileAsync;
  if (fn?.name === "exec") return m().execAsync;
  return m().execFileAsync;
}

const fsPromises = {
  mkdtemp: (...args: unknown[]) => m().fsMkdtemp(...args),
  writeFile: (...args: unknown[]) => m().fsWriteFile(...args),
  rm: (...args: unknown[]) => m().fsRm(...args)
};

vi.mock("child_process", () => {
  const mod = { exec: m().mockExec, execFile: m().mockExecFile };
  return { ...mod, default: mod };
});

vi.mock("node:child_process", () => {
  const mod = { execFile: m().mockExecFile };
  return { ...mod, default: mod };
});

vi.mock("util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("util")>();
  return { ...actual, promisify: promisifyMock, default: { ...actual, promisify: promisifyMock } };
});

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:util")>();
  return { ...actual, promisify: promisifyMock, default: { ...actual, promisify: promisifyMock } };
});

vi.mock("fs", () => {
  const mod = {
    existsSync: m().existsSync,
    readdirSync: m().readdirSync,
    promises: fsPromises
  };
  return { ...mod, default: mod };
});

vi.mock("node:fs", () => {
  const mod = {
    existsSync: m().existsSync,
    readdirSync: m().readdirSync,
    promises: fsPromises
  };
  return { ...mod, default: mod };
});

export function getServiceMocks(): ServiceMocks {
  if (!globalThis.__dashboardServiceMocks) {
    throw new Error("real-path-mocks not initialized — import ./real-path-mocks first");
  }
  return globalThis.__dashboardServiceMocks;
}

/** Point existsSync at a workspace utility script (covers getUtilityPath / resolveNemotronStackScript). */
export function mockUtilityExists(scriptName: string, ws = "/workspace"): void {
  process.env.BUILD_WORKSPACE_DIRECTORY = ws;
  getServiceMocks().existsSync.mockImplementation((p: string) => p === `${ws}/scripts/utilities/${scriptName}`);
}

/** Reset env + mocks between real-path tests. */
export function resetRealPathEnv(): void {
  process.env.USE_MOCKS = "0";
  delete process.env.BUILD_WORKSPACE_DIRECTORY;
  delete process.env.VISUAL_TEST;
  delete process.env.NEXT_PUBLIC_CODER_URL;
  delete process.env.NEXT_PUBLIC_KASM_URL;
  delete process.env.LAB_WORKSPACE_HOST;
  delete process.env.CODER_PORT;
  delete process.env.KASM_PORT;
  const mocks = getServiceMocks();
  mocks.execAsync.mockReset();
  mocks.execFileAsync.mockReset();
  mocks.existsSync.mockReset();
  mocks.readdirSync.mockReset();
  mocks.fsMkdtemp.mockReset();
  mocks.fsWriteFile.mockReset();
  mocks.fsRm.mockReset();
}
