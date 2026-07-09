import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import { templateBelongsToOrg } from "@/lib/server/ownership";
import { checkRateLimit, clientIp } from "@/lib/server/rateLimit";

export const runtime = "edge";

// Hard cap on how much volunteer data we accept in one submission, so an
// anonymous poster can't flood the DB with megabytes per request. Plenty
// of headroom for any realistic form.
const MAX_SUBMISSION_BYTES = 64 * 1024;
const MAX_FIELD_VALUE_LEN = 8 * 1024;

// Per-IP throttle on the anonymous POST. Generous enough for a whole
// student group filling the form behind one campus NAT, tight enough
// that one machine can't fill an org's review queue.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type SubmissionRow = {
    id: string;
    organization_id: string;
    template_id: string;
    data: Record<string, string>;
    created_at: string;
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ submissions: SubmissionRow[] }>(
            `query GetSubmissions($organizationId: uuid!) {
                submissions(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: asc }
                ) {
                    id organization_id template_id data created_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ submissions: data.submissions });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    if (!checkRateLimit(`submissions:${clientIp(req.headers)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
        return NextResponse.json(
            { error: "For mange innsendinger. Vent noen minutter og prøv igjen." },
            { status: 429 },
        );
    }
    const body = await req.text();
    if (body.length > MAX_SUBMISSION_BYTES) {
        return NextResponse.json({ error: "Submission too large" }, { status: 413 });
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }
    const { templateId, data } = parsed as { templateId?: unknown; data?: unknown };
    if (typeof templateId !== "string" || !templateId) {
        return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 });
    }
    // Strict shape: data is a flat string→string map. Reject anything else
    // (arrays, nested objects) so we don't end up serialising "[object Object]"
    // into a cert URL.
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v !== "string") {
            return NextResponse.json({ error: `Field "${k}" must be a string` }, { status: 400 });
        }
        if (v.length > MAX_FIELD_VALUE_LEN) {
            return NextResponse.json({ error: `Field "${k}" is too long` }, { status: 413 });
        }
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        // Cross-org guard: the templateId in the body MUST belong to the org
        // in the URL slug. Without this check, anyone could submit using a
        // different org's template id, breaking cert rendering later.
        if (!(await templateBelongsToOrg(templateId, organizationId))) {
            return NextResponse.json({ error: "Template does not belong to this organization" }, { status: 400 });
        }

        const result = await hasuraAdmin<{
            insert_submissions_one: { id: string; created_at: string };
        }>(
            `mutation InsertSubmission(
                $organizationId: uuid!, $templateId: uuid!, $data: jsonb!
            ) {
                insert_submissions_one(object: {
                    organization_id: $organizationId,
                    template_id: $templateId,
                    data: $data
                }) { id created_at }
            }`,
            { organizationId, templateId, data },
        );
        return NextResponse.json({ submission: result.insert_submissions_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
