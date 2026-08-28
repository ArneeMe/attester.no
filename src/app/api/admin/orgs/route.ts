import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requirePlatformAdmin } from "@/lib/server/platformAdmin";
import { getUserByEmail } from "@/lib/server/authUsers";

export const runtime = "edge";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_SLUG_LEN = 64;
const MAX_NAME_LEN = 200;

export async function GET(req: NextRequest) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{
            organizations: Array<{ id: string; slug: string; name: string }>;
        }>(
            `query AdminListOrgs {
                organizations(order_by: { slug: asc }) { id slug name }
            }`,
        );
        return NextResponse.json({ organizations: data.organizations });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { slug, name, adminEmail } = await req.json().catch(() => ({} as Record<string, unknown>));
    if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > MAX_SLUG_LEN) {
        return NextResponse.json(
            { error: "Ugyldig slug. Bruk små bokstaver, tall og bindestrek" },
            { status: 400 },
        );
    }
    if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LEN) {
        return NextResponse.json({ error: "Ugyldig navn" }, { status: 400 });
    }
    if (typeof adminEmail !== "string" || !adminEmail.includes("@")) {
        return NextResponse.json({ error: "Ugyldig e-postadresse for første medlem" }, { status: 400 });
    }

    try {
        const existing = await hasuraAdmin<{ organizations: Array<{ id: string }> }>(
            `query OrgExists($slug: String!) {
                organizations(where: { slug: { _eq: $slug } }, limit: 1) { id }
            }`,
            { slug },
        );
        if (existing.organizations.length > 0) {
            return NextResponse.json({ error: `Organisasjonen "${slug}" finnes allerede` }, { status: 409 });
        }

        const user = await getUserByEmail(adminEmail.trim().toLowerCase());
        if (!user) {
            return NextResponse.json(
                { error: "Fant ingen brukerkonto for e-posten. Be personen registrere seg på /registrer først." },
                { status: 404 },
            );
        }

        // Client-generated org id lets both inserts share one mutation —
        // Hasura runs the root fields in a single transaction, so we never
        // end up with a memberless org on partial failure.
        const orgId = crypto.randomUUID();
        await hasuraAdmin(
            `mutation CreateOrgWithMember($orgId: uuid!, $slug: String!, $name: String!, $userId: uuid!) {
                insert_organizations_one(object: { id: $orgId, slug: $slug, name: $name }) { id }
                insert_user_organizations_one(object: { user_id: $userId, organization_id: $orgId }) { user_id }
            }`,
            { orgId, slug, name: name.trim(), userId: user.id },
        );
        return NextResponse.json({
            organization: { id: orgId, slug, name: name.trim() },
            firstMember: user.email,
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
