import { noticeChannel } from "../channels";

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
    const channel = noticeChannel();
    if (!channel) return false;
    try {
        await channel.send({
            to: [to],
            subject: `Du er invitert til ${orgName} på attester.no`,
            text:
                `Du er invitert som administrator for ${orgName} på attester.no.\n\n`
                + `Åpne lenken, registrer en konto med denne e-postadressen (eller logg inn hvis du har en), `
                + `så blir du automatisk medlem:\n${link}\n\n`
                + `Lenken er gyldig i 7 dager.`,
        });
        return true;
    } catch {
        return false;
    }
}
