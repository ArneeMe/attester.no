// Push notifications to the platform owner via ntfy. Opt-in: without
// NTFY_TOPIC nothing is sent and the platform runs normally.
//
// An ntfy topic name is its only secret — anyone who learns it can read every
// message on it. So notifications carry NOTHING identifying: no organisation
// name, slug, contact details or message text, only that something is waiting
// and a link to go look.

const DEFAULT_SERVER = "https://ntfy.sh";
const TIMEOUT_MS = 5000;

export async function notifyPlatformOwner(
    title: string,
    message: string,
    link?: string,
): Promise<void> {
    const topic = process.env.NTFY_TOPIC;
    if (!topic) return;

    const server = (process.env.NTFY_SERVER || DEFAULT_SERVER).replace(/\/+$/, "");
    const headers: Record<string, string> = { Title: title };
    if (link) headers.Click = link;

    try {
        const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
            method: "POST",
            headers,
            body: message,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            console.warn("ntfy rejected the notification:", res.status);
        }
    } catch (e) {
        console.warn("Owner notification failed:", (e as Error).message);
    }
}
