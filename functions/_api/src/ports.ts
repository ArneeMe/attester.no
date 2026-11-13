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
