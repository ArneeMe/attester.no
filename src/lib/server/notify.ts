import { hasuraAdmin } from "@/lib/server/hasura";

// Optional email notification to org admins when a submission arrives.
// Entirely opt-in: without RESEND_API_KEY set, everything here is a no-op,
// so the platform runs fine with no email provider configured.
//
// PRIVACY: the notification NEVER contains submission data — only the org
// name and a link to the admin dashboard. Volunteer fields must not leave
// the submissions table by any path other than the issued PDF (CLAUDE.md).

const RESEND_URL = "https://api.resend.com/emails";

export function buildSubmissionNotification(orgName: string, orgSlug: string): {
    subject: string;
    text: string;
} {
    return {
        subject: `Ny innsending venter hos ${orgName}`,
        text:
            `Det har kommet en ny innsending til ${orgName} på attester.no.\n\n`
            + `Logg inn for å behandle den:\n`
            + `https://attester.no/login/adminpage/${orgSlug}\n\n`
            + `Denne e-posten inneholder ingen personopplysninger.`,
    };
}

async function getOrgNameAndAdminEmails(
    organizationId: string,
): Promise<{ name: string | null; emails: string[] }> {
    const data = await hasuraAdmin<{
        organizations: Array<{ name: string }>;
        user_organizations: Array<{ user_id: string }>;
    }>(
        `query NotifyData($organizationId: uuid!) {
            organizations(where: { id: { _eq: $organizationId } }, limit: 1) { name }
            user_organizations(where: { organization_id: { _eq: $organizationId } }) { user_id }
        }`,
        { organizationId },
    );
    const ids = data.user_organizations.map((m) => m.user_id);
    if (ids.length === 0) return { name: data.organizations[0]?.name ?? null, emails: [] };
    const users = await hasuraAdmin<{ users: Array<{ email: string | null }> }>(
        `query GetUserEmails($ids: [uuid!]!) {
            users(where: { id: { _in: $ids } }) { email }
        }`,
        { ids },
    );
    return {
        name: data.organizations[0]?.name ?? null,
        emails: users.users.map((u) => u.email).filter((e): e is string => !!e),
    };
}

/**
 * Notify the org's admins about a new submission. Never throws — a failed
 * or unconfigured notification must not fail the submission itself.
 */
export async function notifyNewSubmission(
    organizationId: string,
    orgSlug: string,
): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;
    const from = process.env.NOTIFY_EMAIL_FROM;
    if (!from) {
        console.warn("RESEND_API_KEY is set but NOTIFY_EMAIL_FROM is not — skipping notification");
        return;
    }

    try {
        const { name, emails: to } = await getOrgNameAndAdminEmails(organizationId);
        if (to.length === 0) return;
        const { subject, text } = buildSubmissionNotification(name ?? orgSlug, orgSlug);
        const res = await fetch(RESEND_URL, {
            method: "POST",
            headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ from, to, subject, text }),
        });
        if (!res.ok) {
            console.error(`Submission notification failed: HTTP ${res.status}`);
        }
    } catch (e) {
        console.error("Submission notification failed:", (e as Error).message);
    }
}
