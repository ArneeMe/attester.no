// Optional email sending via Resend, used by the org invite flow. Entirely
// opt-in: without RESEND_API_KEY set, sendInviteEmail is a no-op and the
// invites feature falls back to showing the link for manual sharing — the
// platform runs fine with no email provider configured.

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Email an org invite link. Returns true if an email was actually sent,
 * false when no provider is configured (caller then shows the link for
 * manual sharing) or the send failed.
 */
export async function sendInviteEmail(
    to: string,
    orgName: string,
    link: string,
): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_EMAIL_FROM;
    if (!apiKey || !from) return false;
    try {
        const res = await fetch(RESEND_URL, {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({
                from,
                to: [to],
                subject: `Du er invitert til ${orgName} på attester.no`,
                text:
                    `Du er invitert som administrator for ${orgName} på attester.no.\n\n`
                    + `Åpne lenken, registrer en konto med denne e-postadressen (eller logg inn hvis du har en), `
                    + `så blir du automatisk medlem:\n${link}\n\n`
                    + `Lenken er gyldig i 7 dager.`,
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}
