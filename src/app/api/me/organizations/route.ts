import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/apiAuth";
import { getUserOrgs } from "@/lib/server/membership";
import { serverError } from "@/lib/server/apiError";

export const runtime = "edge";

export async function GET(req: NextRequest) {
    const auth = await requireSession(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const orgs = await getUserOrgs(auth.userId);
        return NextResponse.json({ organizations: orgs });
    } catch (e) {
        return serverError(e, "api/me/organizations");
    }
}
