import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/server/auth";
import { getUserOrgs } from "@/lib/server/membership";

export const runtime = "edge";

export async function GET(req: NextRequest) {
    const claims = await verifyJwt(req.headers.get("authorization"));
    if (!claims) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    try {
        const orgs = await getUserOrgs(claims.userId);
        return NextResponse.json({ organizations: orgs });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
