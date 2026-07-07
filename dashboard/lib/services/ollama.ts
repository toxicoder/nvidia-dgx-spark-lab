/**
 * Ollama CLI integration for the Tasks panel model list.
 *
 * Invokes `ollama list` on the host; returns raw tab-separated output for
 * client-side parsing. Mocked under `USE_MOCKS=1` via fixtures.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { withMock } from "../host";
import { fakeOllamaRaw } from "../mocks/fixtures";
import type { OllamaModelsResult } from "../types";

const execFileAsync = promisify(execFile);

/**
 * List locally available Ollama models.
 * @returns Raw `ollama list` stdout or an unavailable message.
 */
export async function listOllamaModels(): Promise<OllamaModelsResult> {
  return withMock({ raw: fakeOllamaRaw }, async () => {
    try {
      const { stdout } = await execFileAsync("ollama", ["list"], {
        timeout: 5000
      });
      return { raw: stdout.trim() || "ollama unavailable" };
    } catch {
      return { raw: "ollama unavailable" };
    }
  });
}
