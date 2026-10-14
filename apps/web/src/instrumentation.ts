export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    try {
      const { getAuditServices } = await import("./services/container");
      await getAuditServices();
    } catch (error) {
      // In serverless environments like Vercel, the package root may not be accessible.
      // Services will be initialized on-demand instead.
      console.warn("[instrumentation] Failed to pre-initialize services:", error instanceof Error ? error.message : String(error));
    }
  }
}
