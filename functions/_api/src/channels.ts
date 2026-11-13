import { resendNoticeChannel } from "./adapters/resendNoticeChannel";
import type { NoticeChannel } from "./ports";

let noticeOverride: NoticeChannel | null | undefined;

// Null when no provider is configured. Every caller must cope with that:
// the platform runs without email.
export function noticeChannel(): NoticeChannel | null {
    if (noticeOverride !== undefined) return noticeOverride;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_EMAIL_FROM;
    return apiKey && from ? resendNoticeChannel(apiKey, from) : null;
}

export function useNoticeChannelForTests(channel: NoticeChannel | null | undefined): void {
    noticeOverride = channel;
}
