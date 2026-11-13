import { Router } from "./http";
import { reportError } from "./errors/report";
import { log } from "./lib/log";
import { requestContext, withRequestContext } from "./lib/requestContext";
import * as adminError from "./routes/adminError";
import * as adminErrors from "./routes/adminErrors";
import * as adminOrgRequest from "./routes/adminOrgRequest";
import * as adminOrgRequests from "./routes/adminOrgRequests";
import * as adminOrgs from "./routes/adminOrgs";
import * as asset from "./routes/asset";
import * as assets from "./routes/assets";
import * as branding from "./routes/branding";
import * as certificateVerify from "./routes/certificateVerify";
import * as certificates from "./routes/certificates";
import * as inviteRedeem from "./routes/inviteRedeem";
import * as issue from "./routes/issue";
import * as invites from "./routes/invites";
import * as members from "./routes/members";
import * as myOrganizations from "./routes/myOrganizations";
import * as offeredTemplates from "./routes/offeredTemplates";
import * as preview from "./routes/preview";
import * as org from "./routes/org";
import * as orgRequests from "./routes/orgRequests";
import * as publicOrgs from "./routes/publicOrgs";
import * as recipientCheck from "./routes/recipientCheck";
import * as settings from "./routes/settings";
import * as submission from "./routes/submission";
import * as submissions from "./routes/submissions";
import * as template from "./routes/template";
import * as templates from "./routes/templates";

const router = new Router()
    .add("/orgs", publicOrgs)
    .add("/org-requests", orgRequests)
    .add("/me/organizations", myOrganizations)
    .add("/invites/redeem", inviteRedeem)
    .add("/admin/orgs", adminOrgs)
    .add("/admin/errors", adminErrors)
    .add("/admin/errors/:id", adminError)
    .add("/admin/org-requests", adminOrgRequests)
    .add("/admin/org-requests/:id", adminOrgRequest)
    .add("/org/:slug", org)
    .add("/org/:slug/branding", branding)
    .add("/org/:slug/offered-templates", offeredTemplates)
    .add("/org/:slug/assets", assets)
    .add("/org/:slug/assets/:id", asset)
    .add("/org/:slug/templates", templates)
    .add("/org/:slug/templates/:id", template)
    .add("/org/:slug/submissions", submissions)
    .add("/org/:slug/submissions/:id", submission)
    .add("/org/:slug/submissions/:id/issue", issue)
    .add("/org/:slug/submissions/:id/preview", preview)
    .add("/org/:slug/submissions/:id/recipient-check", recipientCheck)
    .add("/org/:slug/settings", settings)
    .add("/org/:slug/certificates", certificates)
    .add("/org/:slug/certificates/verify", certificateVerify)
    .add("/org/:slug/invites", invites)
    .add("/org/:slug/members", members);

const PREFIX = "/v1";

export function handleApi(req: Request): Promise<Response> {
    return withRequestContext(req.method, async () => {
        const started = Date.now();
        const ctx = requestContext()!;
        let response: Response;
        try {
            response = await route(req);
        } catch (e) {
            reportError(e, "api", ctx.route);
            response = Response.json({ code: "server_error", requestId: ctx.id }, { status: 500 });
        }
        response.headers.set("x-request-id", ctx.id);
        log("info", "request", { status: response.status, ms: Date.now() - started });
        return response;
    });
}

async function route(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }
    return router.handle(req, pathname.slice(PREFIX.length) || "/");
}
