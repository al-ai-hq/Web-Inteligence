export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Integrations</h1>

      {params.connected === "true" && (
        <div className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">
          Google account connected successfully.
        </div>
      )}

      {params.error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
          {params.error === "access_denied"
            ? "Access denied. Please try again."
            : "Something went wrong. Please try again."}
        </div>
      )}

      <div className="rounded-lg border p-6">
        <h2 className="mb-2 text-lg font-semibold">Google Search Console &amp; Analytics</h2>
        <p className="mb-4 text-sm text-gray-600">
          Connect your Google account to include search performance and analytics data in audits.
        </p>
        <form action="/api/oauth/google/authorize" method="GET">
          <input
            type="url"
            name="site_url"
            placeholder="https://example.com"
            required
            className="mb-3 w-full rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Connect Google
          </button>
        </form>
      </div>
    </div>
  );
}
