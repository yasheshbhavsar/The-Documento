/**
 * Utility to identify whether code is running within the Vitest test environment.
 * Centralizes environment branching for test runners.
 */
export function isRunningInTestEnv(): boolean {
  return typeof process !== "undefined" && Boolean(process.env.VITEST);
}
