export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const { getAuditServices } = await import("./services/container");
    await getAuditServices();
  }
}
