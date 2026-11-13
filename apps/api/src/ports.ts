// What the core needs from the outside world. The core imports these types
// and never a provider. A new provider is a new file in adapters/.

export type Notice = {
    to: string[];
    subject: string;
    text: string;
};

// Carries notices only. A notice says that something is waiting, never who
// or what, so it must not be given volunteer data.
export interface NoticeChannel {
    send(notice: Notice): Promise<void>;
}

export type CertificateLetter = {
    // Stable per delivery. The provider must treat a repeat as the same letter.
    id: string;
    nationalId: string;
    subject: string;
    filename: string;
    pdf: Uint8Array;
};

// Delivers a finished certificate to a person's own mailbox.
export interface CertificateChannel {
    readonly name: "digipost";
    canReceive(nationalId: string): Promise<boolean>;
    deliver(letter: CertificateLetter): Promise<void>;
}

export type ErrorReport = {
    fingerprint: string;
    source: "api" | "job";
    // A route pattern or a job name. Never a path with ids in it.
    place: string;
    kind: string;
    // Already scrubbed. See scrub() in lib/log.ts.
    message: string;
    stack: string;
    requestId: string | null;
    count: number;
};

// Where error reports are kept. Returns true when this error has not been
// seen before. Must never throw: failing to record an error is not an error.
export interface ErrorSink {
    record(report: ErrorReport): Promise<boolean>;
}
