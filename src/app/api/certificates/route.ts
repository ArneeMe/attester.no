import { NextRequest, NextResponse } from "next/server";

const HASURA = `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}.hasura.${process.env.NEXT_PUBLIC_NHOST_REGION}.nhost.run`;

function isValidJwt(authHeader: string | null): boolean {
    if (!authHeader?.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        return typeof payload.exp === "number" && payload.exp > Date.now() / 1000;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    if (!isValidJwt(req.headers.get("authorization"))) {
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
