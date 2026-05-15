import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";

export async function GET(req: NextRequest) {
    const volunteerId = req.nextUrl.searchParams.get("volunteerId");
    if (!volunteerId) {
        return NextResponse.json({ error: "Missing volunteerId" }, { status: 400 });
    }

    try {
        const data = await hasuraAdmin<{ certificates: { hash: string }[] }>(
            `query VerifyCertificate($volunteerId: String!) {
                certificates(where: { volunteer_id: { _eq: $volunteerId } }, limit: 1) { hash }
            }`,
            { volunteerId },
        );
        return NextResponse.json({ hash: data.certificates[0]?.hash ?? null });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
