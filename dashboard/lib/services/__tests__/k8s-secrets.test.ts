import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServiceMocks, resetRealPathEnv } from "./real-path-mocks";
import { syncSecretToK8s, removeK8sSecretKey } from "../k8s-secrets";

const target = {
  namespace: "dev" as const,
  secretName: "lab-hf-token",
  key: "HF_TOKEN"
};

describe("k8s-secrets service", () => {
  beforeEach(() => {
    resetRealPathEnv();
    getServiceMocks().fsMkdtemp.mockResolvedValue("/tmp/lab-secret-abc");
    getServiceMocks().fsWriteFile.mockResolvedValue(undefined);
    getServiceMocks().fsRm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.USE_MOCKS = "1";
  });

  it("rejects disallowed namespaces before kubectl", async () => {
    await expect(
      syncSecretToK8s(
        { namespace: "kube-system" as "dev", secretName: "lab-hf-token", key: "HF_TOKEN" },
        "hf_super_secret"
      )
    ).rejects.toThrow(/Namespace not allowed/);
  });

  it("returns mock ok under USE_MOCKS", async () => {
    process.env.USE_MOCKS = "1";
    const result = await syncSecretToK8s(
      { namespace: "ai-inference", secretName: "lab-hf-token", key: "HF_TOKEN" },
      "hf_super_secret"
    );
    expect(result.ok).toBe(true);
  });

  it("syncSecretToK8s applies generated manifest", async () => {
    getServiceMocks()
      .execFileAsync.mockResolvedValueOnce({ stdout: "apiVersion: v1\nkind: Secret", stderr: "" })
      .mockResolvedValueOnce({ stdout: "secret/lab-hf-token configured", stderr: "" });

    const result = await syncSecretToK8s(target, "hf_super_secret");
    expect(result.ok).toBe(true);
    expect(getServiceMocks().execFileAsync).toHaveBeenCalledTimes(2);
    expect(getServiceMocks().fsRm).toHaveBeenCalledWith("/tmp/lab-secret-abc", { recursive: true, force: true });
  });

  it("syncSecretToK8s returns error on kubectl failure", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("kubectl unavailable"));
    const result = await syncSecretToK8s(target, "hf_super_secret");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("kubectl unavailable");
    expect(getServiceMocks().fsRm).toHaveBeenCalled();
  });

  it("syncSecretToK8s maps non-Error failures", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("sync failed");
    const result = await syncSecretToK8s(target, "token");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("sync failed");
  });

  it("removeK8sSecretKey is no-op when key missing", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ data: { OTHER_KEY: "abc" } }),
      stderr: ""
    });

    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
    expect(getServiceMocks().execFileAsync).toHaveBeenCalledTimes(1);
  });

  it("removeK8sSecretKey deletes secret when last key removed", async () => {
    getServiceMocks()
      .execFileAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({ data: { HF_TOKEN: "abc" } }),
        stderr: ""
      })
      .mockResolvedValueOnce({ stdout: "secret deleted", stderr: "" });

    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
    expect(getServiceMocks().execFileAsync).toHaveBeenLastCalledWith(
      "kubectl",
      ["delete", "secret", "lab-hf-token", "-n", "dev"],
      expect.any(Object)
    );
  });

  it("removeK8sSecretKey patches secret when keys remain", async () => {
    getServiceMocks().fsMkdtemp.mockResolvedValue("/tmp/lab-secret-patch-xyz");
    getServiceMocks()
      .execFileAsync.mockResolvedValueOnce({
        stdout: JSON.stringify({ data: { HF_TOKEN: "abc", OTHER: "def" } }),
        stderr: ""
      })
      .mockResolvedValueOnce({ stdout: "secret patched", stderr: "" });

    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
    expect(getServiceMocks().fsWriteFile).toHaveBeenCalled();
    expect(getServiceMocks().fsRm).toHaveBeenCalledWith("/tmp/lab-secret-patch-xyz", { recursive: true, force: true });
  });

  it("removeK8sSecretKey treats NotFound in stderr as success", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ stderr: "Error from server (NotFound): secret not found" });
    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
  });

  it("removeK8sSecretKey treats NotFound in message as success", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue({ message: 'NotFound: secrets "lab-hf-token" not found' });
    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
  });

  it("removeK8sSecretKey returns error for other failures", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue(new Error("kubectl auth failed"));
    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("kubectl auth failed");
  });

  it("removeK8sSecretKey maps non-Error failures", async () => {
    getServiceMocks().execFileAsync.mockRejectedValue("remove failed");
    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("remove failed");
  });

  it("removeK8sSecretKey is ok when secret has no data", async () => {
    getServiceMocks().execFileAsync.mockResolvedValue({ stdout: JSON.stringify({}), stderr: "" });
    const result = await removeK8sSecretKey(target);
    expect(result.ok).toBe(true);
  });
});
