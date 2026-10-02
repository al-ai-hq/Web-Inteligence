import type { AuditContext } from "@wpi/audit-pipeline";

export interface CreateAuditPayload {
  url: string;
  locale: "en" | "ar";
  context: AuditContext;
}

export interface CreateAuditSuccess {
  id: string;
  secret: string;
  status_url: string;
}

export type CreateAuditError = "url_invalid" | "rate_limited" | "generic";

export type CreateAuditResult =
  | { ok: true; data: CreateAuditSuccess }
  | { ok: false; error: CreateAuditError };

export function mapCreateAuditError(
  status: number,
  body: { error?: unknown },
): CreateAuditError {
  if (body.error === "url_invalid") {
    return "url_invalid";
  }
  if (status === 429) {
    return "rate_limited";
  }
  return "generic";
}

export async function submitAudit(
  payload: CreateAuditPayload,
): Promise<CreateAuditResult> {
  let response: Response;
  try {
    response = await fetch("/api/audits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: "generic" };
  }

  let body: unknown = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (response.status === 201) {
    const candidate = body as Partial<CreateAuditSuccess>;
    if (
      typeof candidate.id === "string" &&
      typeof candidate.secret === "string" &&
      typeof candidate.status_url === "string"
    ) {
      return { ok: true, data: candidate as CreateAuditSuccess };
    }
    return { ok: false, error: "generic" };
  }

  return {
    ok: false,
    error: mapCreateAuditError(response.status, body as { error?: unknown }),
  };
}
