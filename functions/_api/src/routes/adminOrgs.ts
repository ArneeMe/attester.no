import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requirePlatformAdmin } from "../lib/platformAdmin";
import { getUserByEmail } from "../lib/authUsers";
import { createOrganizationWithMember, slugIsTaken } from "../lib/createOrg";
import { MAX_NAME_LEN, MAX_SLUG_LEN, SLUG_RE } from "../../../_shared/src/orgRequest";
import { serverError } from "../lib/apiError";

export async function GET(req: Request) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof Response) return auth;

    try {
        const data = await hasuraAdmin<{
            organizations: Array<{ id: string; slug: string; name: string }>;
        }>(
            `query AdminListOrgs {
                organizations(order_by: { slug: asc }) { id slug name }
            }`,
        );
        return json({ organizations: data.organizations });
    } catch (e) {
        return serverError(e, "api/admin/orgs");
    }
}

export async function POST(req: Request) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof Response) return auth;

    const { slug, name, adminEmail } = await req.json().catch(() => ({} as Record<string, unknown>));
    if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > MAX_SLUG_LEN) {
        return json(
            { error: "Ugyldig slug. Bruk små bokstaver, tall og bindestrek" },
            { status: 400 },
        );
    }
    if (typeof name !== "string" || !name.trim() || name.length > MAX_NAME_LEN) {
        return json({ error: "Ugyldig navn" }, { status: 400 });
    }
    if (typeof adminEmail !== "string" || !adminEmail.includes("@")) {
        return json({ error: "Ugyldig e-postadresse for første medlem" }, { status: 400 });
    }

    try {
        if (await slugIsTaken(slug)) {
            return json({ error: `Organisasjonen "${slug}" finnes allerede` }, { status: 409 });
        }

        const user = await getUserByEmail(adminEmail.trim().toLowerCase());
        if (!user) {
            return json(
                { error: "Fant ingen brukerkonto for e-posten. Be personen registrere seg på /registrer først." },
                { status: 404 },
            );
        }

        const orgId = await createOrganizationWithMember(slug, name.trim(), user.id);
        return json({
            organization: { id: orgId, slug, name: name.trim() },
            firstMember: user.email,
        });
    } catch (e) {
        return serverError(e, "api/admin/orgs");
    }
}
