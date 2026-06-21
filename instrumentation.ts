export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateEnvOrThrow } = await import("@/lib/env-check");
  validateEnvOrThrow();
}
