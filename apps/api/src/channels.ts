import { digipostChannel, digipostConfigFromEnv } from "./adapters/digipostChannel";
import { mailpitNoticeChannel } from "./adapters/mailpitNoticeChannel";
import { resendNoticeChannel } from "./adapters/resendNoticeChannel";
import { sealingAvailable } from "./lib/seal";
import { hasuraErrorSink } from "./adapters/hasuraErrorSink";
import type { CertificateChannel, ErrorSink, NoticeChannel } from "./ports";

let noticeOverride: NoticeChannel | null | undefined;

// Null when no provider is configured. Every caller must cope with that:
// the platform runs without email.
export function noticeChannel(): NoticeChannel | null {
    if (noticeOverride !== undefined) return noticeOverride;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_EMAIL_FROM;
    if (apiKey && from) return resendNoticeChannel(apiKey, from);
    // The local test rig catches mail instead of sending it.
    const mailpit = process.env.MAILPIT_URL;
    return mailpit && from ? mailpitNoticeChannel(mailpit, from) : null;
}

export function useNoticeChannelForTests(channel: NoticeChannel | null | undefined): void {
    noticeOverride = channel;
}

let certificateOverride: CertificateChannel | null | undefined;
let digipost: CertificateChannel | null = null;

// Null unless a provider and the sealing key are both configured: a letter
// waiting to be sent is always stored sealed.
export function certificateChannel(): CertificateChannel | null {
    if (!sealingAvailable()) return null;
    if (certificateOverride !== undefined) return certificateOverride;
    const config = digipostConfigFromEnv();
    if (!config) return null;
    digipost ??= digipostChannel(config);
    return digipost;
}

export function useCertificateChannelForTests(channel: CertificateChannel | null | undefined): void {
    certificateOverride = channel;
}

let errorSinkOverride: ErrorSink | null | undefined;
let defaultErrorSink: ErrorSink | null = null;

// ERROR_STORE=off keeps errors in the log only.
export function errorSink(): ErrorSink | null {
    if (errorSinkOverride !== undefined) return errorSinkOverride;
    if (process.env.ERROR_STORE === "off") return null;
    defaultErrorSink ??= hasuraErrorSink();
    return defaultErrorSink;
}

export function useErrorSinkForTests(sink: ErrorSink | null | undefined): void {
    errorSinkOverride = sink;
}
