import { json } from "../http";
import { listPublicOrgs } from "../lib/orgs";
import { serverError } from "../lib/apiError";

export async function GET() {
    try {
        return json({ organizations: await listPublicOrgs() });
    } catch (e) {
        return serverError(e, "api/orgs");
    }
}
