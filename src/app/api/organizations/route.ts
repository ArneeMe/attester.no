import { NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";

export const runtime = "edge";

export type PublicOrg = { id: string; slug: string; name: string };

export async function GET() {
    try {
        const data = await hasuraAdmin<{ organizations: PublicOrg[] }>(
            `query ListOrgs {
                organizations(order_by: { name: asc }) { id slug name }
            }`,
        );
        return NextResponse.json({ organizations: data.organizations });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
