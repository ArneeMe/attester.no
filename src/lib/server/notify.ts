// Outbound email via Resend. Entirely opt-in: without RESEND_API_KEY and
// NOTIFY_EMAIL_FROM the platform runs fine, invites fall back to a link the
// admin shares manually, and owner notifications are skipped.
//
// Owner notifications carry org-level business data ONLY — never volunteer
// fields or submission content. Routing those through email would make the
// platform owner an accidental holder of the personal data the whole design
// exists to avoid holding.

const RESEND_URL = "https://api.resend.com/emails";

export type EmailResult =
    | { sent: true; to: string }
    | { sent: false; reason: "not_configured" | "rejected" | "error"; detail?: string };

/**
 * The single place that talks to Resend. Reports WHY a send failed rather
 * than collapsing every cause into false: a rejected sender domain and a
 * deliberately disabled provider used to be indistinguishable, so a broken
 * configuration looked exactly like a switched-off one.
 */
export async function sendEmail(
    { to, subject, text }: { to: string; subject: string; text: string },
): Promise<EmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_EMAIL_FROM;
    if (!apiKey || !from) {
        return { sent: false, reason: "not_configured", detail: missingConfig(apiKey, from) };
    }
    if (!to) {
        return { sent: false, reason: "not_configured", detail: "No recipient address" };
    }

    try {
        const res = await fetch(RESEND_URL, {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ from, to: [to], subject, text }),
        });
        if (!res.ok) {
            const detail = `${res.status} ${(await res.text().catch(() => "")).slice(0, 500)}`.trim();
            console.warn("Email rejected by Resend:", detail);
            return { sent: false, reason: "rejected", detail };
        }
        return { sent: true, to };
    } catch (e) {
        const detail = (e as Error).message;
        console.warn("Email send failed:", detail);
        return { sent: false, reason: "error", detail };
    }
}

function missingConfig(apiKey: string | undefined, from: string | undefined): string {
    const missing = [!apiKey && "RESEND_API_KEY", !from && "NOTIFY_EMAIL_FROM"].filter(Boolean);
    return `Not set: ${missing.join(", ")}`;
}

/**
 * The address that receives platform notifications. Defaults to the first
 * platform admin, so running the platform needs no second secret — the
 * allowlist already names the owner.
 */
export function platformOwnerEmail(): string | null {
    const explicit = process.env.PLATFORM_NOTIFY_EMAIL?.trim();
    if (explicit) return explicit;
    const first = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)[0];
    return first ?? null;
}

export async function notifyPlatformOwner(subject: string, text: string): Promise<EmailResult> {
    const to = platformOwnerEmail();
    if (!to) {
        return {
            sent: false,
            reason: "not_configured",
            detail: "Not set: PLATFORM_NOTIFY_EMAIL or PLATFORM_ADMIN_EMAILS",
        };
    }
    return sendEmail({ to, subject, text });
}

export async function sendInviteEmail(
    to: string,
    orgName: string,
    link: string,
): Promise<boolean> {
    const result = await sendEmail({
        to,
        subject: `Du er invitert til ${orgName} på attester.no`,
        text:
            `Du er invitert som administrator for ${orgName} på attester.no.\n\n`
            + `Åpne lenken, registrer en konto med denne e-postadressen (eller logg inn hvis du har en), `
            + `så blir du automatisk medlem:\n${link}\n\n`
            + `Lenken er gyldig i 7 dager.`,
    });
    return result.sent;
}
