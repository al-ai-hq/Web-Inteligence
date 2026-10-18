import { NextResponse, type NextRequest } from "next/server";
import { OUTCOME_METRICS, type OutcomeMetric } from "@wpi/audit-pipeline";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { authorizeRecord } from "../../../../../../../services/access";
import { getAuditServices } from "../../../../../../../services/container";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

// Own bucket so marking items applied cannot spend the user's audit-creation budget.
const APPLY_RATE_LIMIT_PROJECT = "recommendation-apply";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
}

function notFound(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 404, headers: NO_STORE_HEADERS });
}

/**
 * Metrics a single "applied" mark is measured against: the category the rule
 * belongs to (what the user actually acted on) plus the overall readiness score,
 * which is what the dashboard delta card compares.
 */
function metricsFor(category: string | null): OutcomeMetric[] {
  const wanted = new Set<OutcomeMetric>(["presence_readiness"]);
  if (category !== null && (OUTCOME_METRICS as readonly string[]).includes(category)) {
    wanted.add(category as OutcomeMetric);
  }
  return [...wanted];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> },
): Promise<NextResponse> {
  const { id, findingId } = await params;
  const services = await getAuditServices();

  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue ? await services.auth.getSessionUser(hashToken(cookieValue)) : null;
  if (user === null) {
    return unauthorized();
  }

  const rateLimit = await services.rateLimiter.checkUser(user.id, APPLY_RATE_LIMIT_PROJECT);
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      0,
      Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining)),
        },
      },
    );
  }

  // Anonymous share links are deliberately excluded: a mark is a claim about
  // work done, so only the signed-in owner of the audit may record it.
  const access = await authorizeRecord(services.store, id, undefined, user.id);
  if (access.kind !== "authorized") {
    return notFound("not_found");
  }

  const item = access.record.report?.action_board.find(
    (entry) => entry.source_finding_id === findingId,
  );
  if (item === undefined) {
    return notFound("finding_not_found");
  }

  const outcomes = await Promise.all(
    metricsFor(item.category).map((metric) =>
      services.outcomeStore.markApplied({
        userId: user.id,
        ruleId: item.title,
        auditIdApplied: id,
        metric,
      }),
    ),
  );

  return NextResponse.json(
    { outcomes },
    { headers: { ...NO_STORE_HEADERS, "X-RateLimit-Remaining": String(rateLimit.remaining) } },
  );
}
