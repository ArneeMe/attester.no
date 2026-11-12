import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { serverError } from "../lib/apiError";

type OrgRow = {
    id: string;
    slug: string;
    name: string;
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    try {
        const data = await hasuraAdmin<{ organizations: OrgRow[] }>(
            `query GetOrg($slug: String!) {
                organizations(where: { slug: { _eq: $slug } }, limit: 1) {
                    id slug name
                }
            }`,
            { slug },
        );
        const org = data.organizations[0];
        if (!org) return json({ error: "Not found" }, { status: 404 });
        return json({ organization: org });
    } catch (e) {
        return serverError(e, "api/org/[slug]");
    }
}
