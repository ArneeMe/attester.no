import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { verifyJwt } from "@/lib/server/auth";
import { userBelongsToOrg } from "@/lib/server/membership";

export const runtime = "edge";

export async function POST(req: NextRequest) {
    const claims = await verifyJwt(req.headers.get("authorization"));
    if (!claims) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { organizationId, volunteerId, hash } = await req.json();
    if (!organizationId || !volunteerId || !hash) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!(await userBelongsToOrg(claims.userId, organizationId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const data = await hasuraAdmin<{ insert_certificates_one: { id: string } }>(
            `mutation InsertCertificate($organizationId: uuid!, $volunteerId: String!, $hash: String!) {
                insert_certificates_one(object: {
                    organization_id: $organizationId, volunteer_id: $volunteerId, hash: $hash
                }) { id }
            }`,
            { organizationId, volunteerId, hash },
        );
        return NextResponse.json({ id: data.insert_certificates_one.id });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
