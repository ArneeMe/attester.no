import { NextRequest, NextResponse } from "next/server";

const SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const REGION = process.env.NEXT_PUBLIC_NHOST_REGION;
const HASURA = `https://${SUBDOMAIN}.hasura.${REGION}.nhost.run`;
const AUTH = `https://${SUBDOMAIN}.auth.${REGION}.nhost.run`;

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const userRes = await fetch(`${AUTH}/user`, { headers: { authorization: authHeader } });
    if (!userRes.ok) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { organizationId, volunteerId, hash } = await req.json();
    if (!organizationId || !volunteerId || !hash) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET!,
        },
        body: JSON.stringify({
            query: `
                mutation InsertCertificate($organizationId: uuid!, $volunteerId: String!, $hash: String!) {
                    insert_certificates_one(object: {
                        organization_id: $organizationId, volunteer_id: $volunteerId, hash: $hash
                    }) { id }
                }
            `,
            variables: { organizationId, volunteerId, hash },
        }),
    });

    const json = await res.json();
    if (json.errors?.length) {
        return NextResponse.json({ error: json.errors[0].message }, { status: 500 });
    }

    return NextResponse.json({ id: json.data.insert_certificates_one.id });
}
