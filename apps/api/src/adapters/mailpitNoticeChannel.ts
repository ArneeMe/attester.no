import type { Notice, NoticeChannel } from "../ports";

// For the local test rig only: hands notices to Mailpit, a mail catcher, so
// they can be read in a browser and never leave the machine.
export function mailpitNoticeChannel(baseUrl: string, from: string): NoticeChannel {
    return {
        async send(notice: Notice): Promise<void> {
            const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v1/send`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    From: { Email: from },
                    To: notice.to.map((Email) => ({ Email })),
                    Subject: notice.subject,
                    Text: notice.text,
                }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`Mailpit answered ${res.status}`);
        },
    };
}
