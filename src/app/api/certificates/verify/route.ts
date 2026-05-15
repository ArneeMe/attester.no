import { NextRequest, NextResponse } from "next/server";

const HASURA = `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}.hasura.${process.env.NEXT_PUBLIC_NHOST_REGION}.nhost.run`;

export async function GET(req: NextRequest) {
    const volunteerId = req.nextUrl.searchParams.get("volunteerId");
    if (!volunteerId) {
        return NextResponse.json({ error: "Missing volunteerId" }, { status: 400 });
    }

    const res = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET!,
        },
        body: JSON.stringify({
            query: `
                query VerifyCertificate($volunteerId: String!) {
                    certificates(where: { volunteer_id: { _eq: $volunteerId } }, limit: 1) { hash }
                }
            `,
            variables: { volunteerId },
        }),
    });

    const json = await res.json();
    if (json.errors?.length) {
        return NextResponse.json({ error: json.errors[0].message }, { status: 500 });
    }

    return NextResponse.json({ hash: json.data.certificates[0]?.hash ?? null });
}
