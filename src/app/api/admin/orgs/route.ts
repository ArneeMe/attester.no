import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requirePlatformAdmin } from "@/lib/server/platformAdmin";
import { getUserByEmail } from "@/lib/server/authUsers";
import { createOrganizationWithMember, slugIsTaken } from "@/lib/server/createOrg";
import { MAX_NAME_LEN, MAX_SLUG_LEN, SLUG_RE } from "@/util/orgRequest";
import { serverError } from "@/lib/server/apiError";

export const runtime = "edge";

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
        return serverError(e, "api/admin/orgs");
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
        if (await slugIsTaken(slug)) {
            return NextResponse.json({ error: `Organisasjonen "${slug}" finnes allerede` }, { status: 409 });
        }

        const user = await getUserByEmail(adminEmail.trim().toLowerCase());
        if (!user) {
            return NextResponse.json(
                { error: "Fant ingen brukerkonto for e-posten. Be personen registrere seg på /registrer først." },
                { status: 404 },
            );
        }

        const orgId = await createOrganizationWithMember(slug, name.trim(), user.id);
        return NextResponse.json({
            organization: { id: orgId, slug, name: name.trim() },
            firstMember: user.email,
        });
    } catch (e) {
        return serverError(e, "api/admin/orgs");
    }
}
