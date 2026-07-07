/**
 * Host integration barrel — re-exports all lab service modules.
 *
 * Consumers (server actions, RSC pages) import from `@/lib/host` rather than
 * individual `services/*` files. Implementations live in `./services/*`;
 * this module also provides {@link withMock} for hermetic test mode.
 *
 * Related: `docker-compose.yml` volume mounts, `USE_MOCKS=1` in vitest setup.
 */

export * from "./services/docker";
export * from "./services/ollama";
export * from "./services/storage";
export * from "./services/system";
export * from "./services/utilities";
export * from "./services/dev-workspaces";
export * from "./services/cluster-resources";
export * from "./services/inference-workloads";
export * from "./services/nemotron-stack";
export * from "./services/open-webui-stack";
export * from "./services/monitoring-stack";
export { listSecrets } from "./db/repositories/lab-secrets";

/**
 * Run real command or return mock data when `USE_MOCKS=1`.
 * Centralizes the common pattern used across services for hermetic tests.
 * @param mock - Value returned under mock mode.
 * @param real - Async or sync function for real execution.
 * @returns Mock value or the result of `real()`.
 */
export function withMock<T>(mock: T, real: () => Promise<T> | T): Promise<T> | T {
  if (process.env.USE_MOCKS === "1") {
    return mock;
  }
  return real();
}
