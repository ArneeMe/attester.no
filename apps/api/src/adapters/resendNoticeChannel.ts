import type { Notice, NoticeChannel } from "../ports";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 5000;

export function resendNoticeChannel(apiKey: string, from: string): NoticeChannel {
    return {
        async send(notice: Notice): Promise<void> {
            const res = await fetch(RESEND_URL, {
                method: "POST",
                headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
                body: JSON.stringify({ from, to: notice.to, subject: notice.subject, text: notice.text }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`Resend answered ${res.status}`);
        },
    };
}
