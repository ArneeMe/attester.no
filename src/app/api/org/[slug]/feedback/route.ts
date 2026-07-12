import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import { checkRateLimit, clientIp } from "@/lib/server/rateLimit";

export const runtime = "edge";

const MAX_COMMENT_LEN = 2000;

// Anonymous endpoint → throttle like the submissions POST, but tighter:
// nobody legitimately leaves many ratings from one machine.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type FeedbackRow = { id: string; rating: number; comment: string; created_at: string };

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ feedback: FeedbackRow[] }>(
            `query GetFeedback($organizationId: uuid!) {
                feedback(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: desc }
                ) { id rating comment created_at }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ feedback: data.feedback });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    if (!checkRateLimit(`feedback:${clientIp(req.headers)}`, RATE_LIMIT, RATE_WINDOW_MS)) {
        return NextResponse.json({ error: "For mange tilbakemeldinger. Prøv igjen senere." }, { status: 429 });
    }

    const { rating, comment } = await req.json().catch(() => ({} as Record<string, unknown>));
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
        return NextResponse.json({ error: "Rating must be an integer 1-5" }, { status: 400 });
    }
    if (comment !== undefined && typeof comment !== "string") {
        return NextResponse.json({ error: "Comment must be a string" }, { status: 400 });
    }
    if (typeof comment === "string" && comment.length > MAX_COMMENT_LEN) {
        return NextResponse.json({ error: "Comment is too long" }, { status: 413 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }
        await hasuraAdmin(
            `mutation InsertFeedback($organizationId: uuid!, $rating: Int!, $comment: String!) {
                insert_feedback_one(object: {
                    organization_id: $organizationId,
                    rating: $rating,
                    comment: $comment
                }) { id }
            }`,
            { organizationId, rating, comment: (comment as string | undefined)?.trim() ?? "" },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { id } = await req.json().catch(() => ({} as { id?: unknown }));
    if (typeof id !== "string" || !id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    try {
        // Org-scoped delete: the where clause pins the org id from the
        // membership check, so an admin can't delete another org's rows.
        await hasuraAdmin(
            `mutation DeleteFeedback($id: uuid!, $organizationId: uuid!) {
                delete_feedback(where: {
                    id: { _eq: $id },
                    organization_id: { _eq: $organizationId }
                }) { affected_rows }
            }`,
            { id, organizationId: auth.organizationId },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
