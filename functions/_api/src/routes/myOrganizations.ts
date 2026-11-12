import { json } from "../http";
import { requireSession } from "../lib/apiAuth";
import { getUserOrgs } from "../lib/membership";
import { serverError } from "../lib/apiError";

export async function GET(req: Request) {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;

    try {
        const orgs = await getUserOrgs(auth.userId);
        return json({ organizations: orgs });
    } catch (e) {
        return serverError(e, "api/me/organizations");
    }
}
