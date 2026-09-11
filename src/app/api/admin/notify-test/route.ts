import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server/platformAdmin";
import { notifyPlatformOwner, platformOwnerEmail } from "@/lib/server/notify";

export const runtime = "edge";

export async function POST(req: NextRequest) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const result = await notifyPlatformOwner(
        "Testvarsel fra attester.no",
        "Dette er en test av e-postvarsling fra attester.no.\n\n"
        + `Utløst av ${auth.email}.\n\n`
        + "Får du denne, virker varslingen.",
    );
    return NextResponse.json({ ...result, owner: platformOwnerEmail() });
}
