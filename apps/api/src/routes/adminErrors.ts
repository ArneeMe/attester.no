import { json } from "../http";
import { requirePlatformAdmin } from "../lib/platformAdmin";
import { serverError } from "../lib/apiError";
import { listErrors } from "../errors/store";

export async function GET(req: Request) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof Response) return auth;

    try {
        return json({ errors: await listErrors() });
    } catch (e) {
        return serverError(e, "api/admin/errors");
    }
}
