import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";

export const runtime = "edge";

type OrgRow = {
    id: string;
    slug: string;
    name: string;
};

export async function GET(
    _req: NextRequest,
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
        if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ organization: org });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
