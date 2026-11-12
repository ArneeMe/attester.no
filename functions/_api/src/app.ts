import { Router } from "./http";
import * as adminOrgRequest from "./routes/adminOrgRequest";
import * as adminOrgRequests from "./routes/adminOrgRequests";
import * as adminOrgs from "./routes/adminOrgs";
import * as asset from "./routes/asset";
import * as assets from "./routes/assets";
import * as branding from "./routes/branding";
import * as certificateVerify from "./routes/certificateVerify";
import * as certificates from "./routes/certificates";
import * as inviteRedeem from "./routes/inviteRedeem";
import * as invites from "./routes/invites";
import * as members from "./routes/members";
import * as myOrganizations from "./routes/myOrganizations";
import * as offeredTemplates from "./routes/offeredTemplates";
import * as org from "./routes/org";
import * as orgRequests from "./routes/orgRequests";
import * as publicOrgs from "./routes/publicOrgs";
import * as submission from "./routes/submission";
import * as submissions from "./routes/submissions";
import * as template from "./routes/template";
import * as templates from "./routes/templates";

export const PATH_PARAM = "__path";

const router = new Router()
    .add("/orgs", publicOrgs)
    .add("/org-requests", orgRequests)
    .add("/me/organizations", myOrganizations)
    .add("/invites/redeem", inviteRedeem)
    .add("/admin/orgs", adminOrgs)
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
    .add("/org/:slug/certificates", certificates)
    .add("/org/:slug/certificates/verify", certificateVerify)
    .add("/org/:slug/invites", invites)
    .add("/org/:slug/members", members);

export async function handleApi(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.searchParams.get(PATH_PARAM) ?? url.pathname;
    try {
        return await router.handle(req, path);
    } catch (e) {
        console.error(`api ${req.method} ${path}:`, (e as Error).message);
        return Response.json({ code: "server_error" }, { status: 500 });
    }
}
