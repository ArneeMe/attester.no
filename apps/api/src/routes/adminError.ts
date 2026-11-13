import { json } from "../http";
import { requirePlatformAdmin } from "../lib/platformAdmin";
import { serverError } from "../lib/apiError";
import { isUuid } from "../lib/input";
import { resolveError } from "../errors/store";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof Response) return auth;
    if (!isUuid(id)) return json({ error: "Not found" }, { status: 404 });

    try {
        if (!(await resolveError(id))) return json({ error: "Not found" }, { status: 404 });
        return json({ ok: true });
    } catch (e) {
        return serverError(e, "api/admin/errors/[id]");
    }
}
