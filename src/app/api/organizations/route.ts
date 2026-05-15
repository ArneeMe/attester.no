import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { isValidJwt } from "@/lib/server/auth";

type OrgRow = {
    id: string;
    slug: string;
    name: string;
    generic_text: string | null;
    groups: Record<string, string> | null;
    signatures: Array<{ photo: string; name: string; role: string; phone: string }> | null;
};

export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    try {
        const data = await hasuraAdmin<{ organizations: OrgRow[] }>(
            `query GetOrg($slug: String!) {
                organizations(where: { slug: { _eq: $slug } }, limit: 1) {
                    id slug name generic_text groups signatures
                }
            }`,
            { slug },
        );
        const org = data.organizations[0];
        if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ organization: org });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!isValidJwt(req.headers.get("authorization"))) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { slug, genericText, groups, signatures } = await req.json();
    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const fields: Record<string, unknown> = {};
    if (genericText !== undefined) fields.generic_text = genericText;
    if (groups !== undefined) fields.groups = groups;
    if (signatures !== undefined) fields.signatures = signatures;

    try {
        const data = await hasuraAdmin<{ update_organizations: { affected_rows: number } }>(
            `mutation UpdateOrg($slug: String!, $set: organizations_set_input!) {
                update_organizations(where: { slug: { _eq: $slug } }, _set: $set) { affected_rows }
            }`,
            { slug, set: fields },
        );
        return NextResponse.json({ affectedRows: data.update_organizations.affected_rows });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
