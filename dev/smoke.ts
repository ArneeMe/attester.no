// One real pass through the running rig: a volunteer submits, an admin
// issues, the letter goes to the fake Digipost, the certificate verifies.
// Every step talks to the real API, database and auth service.
import { canonicalHash } from "../packages/shared/src/canonicalHash";
import { selectHashFields } from "../packages/shared/src/verifyFieldSelection";
import { ADMIN_SECRET, API, AUTH, DIGIPOST, HASURA, MAILPIT, PASSWORD, USERS, WITH_DIGIPOST } from "./stack";

let step = 0;
function check(ok: unknown, what: string): void {
    step++;
    if (!ok) {
        console.error(`✘ ${step}. ${what}`);
        process.exit(1);
    }
    console.log(`✓ ${step}. ${what}`);
}

async function signIn(email: string): Promise<string> {
    const res = await fetch(`${AUTH}/signin/email-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: PASSWORD }),
    });
    const json = await res.json();
    if (!json.session?.accessToken) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(json).slice(0, 200)}`);
    return json.session.accessToken;
}

async function api(method: string, pathname: string, opts: { token?: string; body?: unknown } = {}) {
    const res = await fetch(`${API}${pathname}`, {
        method,
        headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any, requestId: res.headers.get("x-request-id") };
}

async function main(): Promise<void> {
    const admin = await signIn(USERS.admin);
    const owner = await signIn(USERS.owner);
    const other = await signIn(USERS.other);
    check(admin && owner && other, "three test users can sign in against the real auth service");

    const orgs = await api("GET", "/me/organizations", { token: admin });
    check(orgs.status === 200 && orgs.json.organizations?.[0]?.slug === "testorg", "the admin sees their organisation");
    check((await api("GET", "/me/organizations")).status === 401, "no token, no answer");

    const org = await api("GET", "/org/testorg");
    check(org.json.organization?.name && org.json.digipost === true, "the public form learns that Digipost is offered");
    const offered = await api("GET", "/org/testorg/offered-templates");
    const templateId = offered.json.templates?.[0]?.id;
    check(templateId, "one template is offered");
    const template = await api("GET", `/org/testorg/templates/${templateId}`);
    const schema = template.json.template?.form_schema;
    check(Array.isArray(schema) && schema.length > 0, "the form's fields are served");

    const data = Object.fromEntries(schema.map((f: { key: string; type: string }) => [f.key, f.type === "date" ? "2026-06-01" : `Prøve Æøå & ${f.key}`]));
    const hidden = await api("POST", "/org/testorg/submissions", { body: { templateId, data: { ...data, brand: "x" } } });
    check(hidden.status === 400, "a field the form does not declare is refused");
    const submitted = await api("POST", "/org/testorg/submissions", { body: { templateId, data, nationalId: WITH_DIGIPOST } });
    const statusToken = submitted.json.statusToken;
    const submissionId = submitted.json.submission?.id;
    check(submitted.status === 200 && submissionId && statusToken, "a volunteer can submit, and gets a status token");

    const waiting = await api("POST", "/org/testorg/status", { body: { token: statusToken } });
    check(waiting.json.status === "waiting" && !JSON.stringify(waiting.json).includes(submissionId), "the status page says waiting, with dates only");
    check((await api("POST", "/org/annenorg/status", { body: { token: statusToken } })).status === 404, "the token works for its own organisation only");
    check((await api("POST", "/org/testorg/status/remind", { body: { token: statusToken } })).status === 429, "a reminder is refused on the first day");

    const queue = await api("GET", "/org/testorg/submissions", { token: admin });
    const row = queue.json.submissions?.find((s: { id: string }) => s.id === submissionId);
    check(row?.has_recipient === true && !JSON.stringify(queue.json).includes(WITH_DIGIPOST), "the admin sees that a recipient exists, never the number");
    check((await api("GET", "/org/testorg/submissions", { token: other })).status === 403, "another organisation's admin is refused");
    check((await api("GET", "/me/organizations", { token: admin })).json.organizations[0].pending >= 1, "the pending count includes it");

    const stored = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ query: `{ submission_recipients { national_id_enc } submissions { status_token_hash } }` }),
    }).then((r) => r.json());
    const dump = JSON.stringify(stored);
    check(stored.data && !dump.includes(WITH_DIGIPOST) && !dump.includes(statusToken), "the database holds neither the fødselsnummer nor the status token in the clear");

    const canReceive = await api("POST", `/org/testorg/submissions/${submissionId}/recipient-check`, { token: admin });
    check(canReceive.json.canReceive === true, "Digipost is asked, with a signature it accepts, and says yes");

    const preview = await api("POST", `/org/testorg/submissions/${submissionId}/preview`, { token: admin });
    check(Buffer.from(preview.json.pdf ?? "", "base64").subarray(0, 5).toString() === "%PDF-", "the preview is a PDF");
    check((await api("GET", `/org/testorg/certificates/verify?submissionId=${submissionId}`)).json.hash === null, "a preview registers nothing");

    const issued = await api("POST", `/org/testorg/submissions/${submissionId}/issue`, { token: admin, body: { deliver: "digipost" } });
    check(issued.status === 200 && Buffer.from(issued.json.pdf, "base64").subarray(0, 5).toString() === "%PDF-", "the certificate is issued as a PDF");
    check(issued.json.delivery?.status === "sent", "and delivered to Digipost");

    const verifyUrl = new URL(issued.json.verifyUrl);
    const params: Record<string, string> = {};
    verifyUrl.searchParams.forEach((value, key) => { if (key !== "t") params[key] = value; });
    const recomputed = await canonicalHash(new URLSearchParams(selectHashFields(schema, params)));
    const registered = await api("GET", `/org/testorg/certificates/verify?submissionId=${submissionId}`);
    check(registered.json.hash === recomputed, "the hash in the database is the one the verify page computes from the QR link");

    const letters = await fetch(`${DIGIPOST}/letters`).then((r) => r.json());
    check(letters.length >= 1 && letters.at(-1).recipient === WITH_DIGIPOST && letters.at(-1).pdfBytes > 1000, "Digipost received the PDF for the right person");

    const again = await api("POST", `/org/testorg/submissions/${submissionId}/issue`, { token: admin, body: { deliver: "digipost" } });
    const lettersAfter = await fetch(`${DIGIPOST}/letters`).then((r) => r.json());
    check(again.json.alreadyIssued === true && lettersAfter.length === letters.length, "issuing again makes no second certificate and no second letter");

    const after = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ query: `{ submission_recipients { submission_id } deliveries { status payload } }` }),
    }).then((r) => r.json());
    check(
        after.data.submission_recipients.length === 0 && after.data.deliveries.every((d: { payload: string | null }) => d.payload === null),
        "once sent, the fødselsnummer and the queued PDF are gone from the database",
    );

    const done = await api("POST", "/org/testorg/status", { body: { token: statusToken } });
    check(done.json.status === "issued" && done.json.digipost?.status === "sent" && done.json.reminder === null, "the status page now says issued and sent");

    let mail: any[] = [];
    for (let i = 0; i < 10 && mail.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 500));
        mail = (await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json())).messages.filter((m: any) => m.Subject.startsWith("Forespørsler om attest venter"));
    }
    check(mail.length >= 1 && mail[0].To.some((t: { Address: string }) => t.Address === USERS.admin), "the admin was emailed that a request is waiting");

    check((await api("PATCH", "/org/testorg/settings", { token: admin, body: { digipostEnabled: false } })).status === 403, "an organisation cannot change its own Digipost access");
    check((await api("GET", "/admin/orgs", { token: owner })).status === 200, "the platform owner reaches /admin");
    check((await api("GET", "/admin/orgs", { token: admin })).status === 403, "an ordinary admin does not");

    const light = await api("GET", "/org/testorg/templates", { token: admin });
    check(light.json.templates?.length >= 1 && !("base_pdf" in light.json.templates[0]), "the templates list is light");
    const full = await api("GET", `/org/testorg/templates/${templateId}/full`, { token: admin });
    check(String(full.json.template?.base_pdf).startsWith("data:application/pdf"), "one full template can be fetched for the designer");
    const saved = await api("POST", "/org/testorg/templates", {
        token: admin,
        body: { name: "Røyktest", basePdf: full.json.template.base_pdf, schemas: full.json.template.schemas, formSchema: schema, fieldBindings: full.json.template.field_bindings, isOffered: false },
    });
    check(saved.status === 200, "a template can be saved");
    const noQr = await api("POST", "/org/testorg/templates", { token: admin, body: { name: "Uten QR", basePdf: full.json.template.base_pdf, schemas: [[]] } });
    check(noQr.status === 400, "a template without a QR code is refused by the server");

    await api("POST", "/errors", { body: { source: "browser", place: "/org/:slug", kind: "SmokeError", message: 'broke for "Ola" 01018099912', stack: "at f (app.js:1:2)" } });
    let errors: any[] = [];
    for (let i = 0; i < 10 && errors.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 500));
        errors = ((await api("GET", "/admin/errors", { token: owner })).json.errors ?? []).filter((e: { kind: string }) => e.kind === "SmokeError");
    }
    check(errors.length === 1 && !JSON.stringify(errors).includes("Ola") && !JSON.stringify(errors).includes("01018099912"), "a browser error reaches the owner's list, scrubbed");

    const removed = await api("DELETE", `/org/testorg/submissions/${submissionId}`, { token: admin });
    check(removed.status === 200 && (await api("POST", "/org/testorg/status", { body: { token: statusToken } })).status === 404, "deleting the submission ends its status link too");
    check((await api("GET", `/org/testorg/certificates/verify?submissionId=${submissionId}`)).json.hash === recomputed, "and the certificate still verifies afterwards");

    console.log(`\nAlt virker: ${step} sjekker mot ekte database, innlogging og API.`);
}

main().catch((e) => {
    console.error(`✘ ${step + 1}. ${e.message}`);
    process.exit(1);
});
