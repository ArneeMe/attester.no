import { hasuraAdmin } from "../lib/hasura";
import { seal, unseal } from "../lib/seal";
import { certificateChannel } from "../channels";
import { deleteRecipient } from "./recipients";

// How long a letter may wait in the queue. After this the PDF and the
// recipient are erased whether or not it was sent.
export const DELIVERY_TTL_HOURS = 24;
// Each letter costs attester.no money and carries its name.
export const DIGIPOST_DAILY_LIMIT = 100;
const MAX_ATTEMPTS = 5;
const BATCH = 10;

export type DeliveryStatus = "queued" | "sent" | "failed";
export type DeliveryView = { channel: string; status: DeliveryStatus; sentAt: string | null };

type Payload = { nationalId: string; subject: string; filename: string; pdf: string };

type Row = {
    id: string;
    submission_id: string;
    status: DeliveryStatus;
    payload: string | null;
    attempts: number;
    sent_at: string | null;
    expires_at: string;
};

const FIELDS = "id submission_id status payload attempts sent_at expires_at";

export type QueueInput = {
    organizationId: string;
    submissionId: string;
    nationalId: string;
    subject: string;
    filename: string;
    pdf: Uint8Array;
};

/**
 * Put a certificate in the queue for its channel. One delivery exists per
 * certificate: a sent one is returned as it is, a failed one is queued again.
 */
export async function queueDelivery(input: QueueInput, now: Date = new Date()): Promise<Row> {
    const existing = await hasuraAdmin<{ deliveries: Row[] }>(
        `query ExistingDelivery($organizationId: uuid!, $submissionId: String!) {
            deliveries(where: {
                organization_id: { _eq: $organizationId },
                submission_id: { _eq: $submissionId },
                channel: { _eq: "digipost" }
            }, limit: 1) { ${FIELDS} }
        }`,
        { organizationId: input.organizationId, submissionId: input.submissionId },
    );
    const row = existing.deliveries[0];
    if (row && row.status !== "failed") return row;

    const payload: Payload = {
        nationalId: input.nationalId,
        subject: input.subject,
        filename: input.filename,
        pdf: Buffer.from(input.pdf).toString("base64"),
    };
    const variables = {
        payload: seal(JSON.stringify(payload)),
        expiresAt: new Date(now.getTime() + DELIVERY_TTL_HOURS * 3600_000).toISOString(),
    };
    if (row) {
        const updated = await hasuraAdmin<{ update_deliveries_by_pk: Row }>(
            `mutation RequeueDelivery($id: uuid!, $payload: String!, $expiresAt: timestamptz!) {
                update_deliveries_by_pk(
                    pk_columns: { id: $id },
                    _set: { status: "queued", payload: $payload, attempts: 0, expires_at: $expiresAt }
                ) { ${FIELDS} }
            }`,
            { id: row.id, ...variables },
        );
        return updated.update_deliveries_by_pk;
    }
    const inserted = await hasuraAdmin<{ insert_deliveries_one: Row }>(
        `mutation QueueDelivery($organizationId: uuid!, $submissionId: String!, $payload: String!, $expiresAt: timestamptz!) {
            insert_deliveries_one(object: {
                organization_id: $organizationId,
                submission_id: $submissionId,
                channel: "digipost",
                payload: $payload,
                expires_at: $expiresAt
            }) { ${FIELDS} }
        }`,
        { organizationId: input.organizationId, submissionId: input.submissionId, ...variables },
    );
    return inserted.insert_deliveries_one;
}

async function finish(row: Row, status: "sent" | "failed", now: Date): Promise<void> {
    await hasuraAdmin(
        `mutation FinishDelivery($id: uuid!, $status: String!, $sentAt: timestamptz) {
            update_deliveries_by_pk(
                pk_columns: { id: $id },
                _set: { status: $status, payload: null, sent_at: $sentAt }
            ) { id }
        }`,
        { id: row.id, status, sentAt: status === "sent" ? now.toISOString() : null },
    );
}

/**
 * Try to send one queued delivery. On success the PDF and the recipient are
 * erased at once. On failure the row stays queued for the next tick, until
 * it runs out of attempts or time. Never throws.
 */
export async function attemptDelivery(row: Row, now: Date = new Date()): Promise<DeliveryStatus> {
    if (row.status !== "queued" || !row.payload) return row.status;
    try {
        if (new Date(row.expires_at).getTime() <= now.getTime() || row.attempts >= MAX_ATTEMPTS) {
            await finish(row, "failed", now);
            return "failed";
        }
        const channel = certificateChannel();
        if (!channel) return "queued";
        const payload = JSON.parse(unseal(row.payload)) as Payload;
        try {
            await channel.deliver({
                id: row.id,
                nationalId: payload.nationalId,
                subject: payload.subject,
                filename: payload.filename,
                pdf: new Uint8Array(Buffer.from(payload.pdf, "base64")),
            });
        } catch (e) {
            // The provider's message may quote the request. Log the kind of failure only.
            console.error("Delivery attempt failed:", (e as Error).name);
            await hasuraAdmin(
                `mutation DeliveryAttempt($id: uuid!) {
                    update_deliveries_by_pk(pk_columns: { id: $id }, _inc: { attempts: 1 }) { id }
                }`,
                { id: row.id },
            );
            return "queued";
        }
        await finish(row, "sent", now);
        await deleteRecipient(row.submission_id).catch(() => undefined);
        return "sent";
    } catch (e) {
        console.error("Delivery bookkeeping failed:", (e as Error).name);
        return "queued";
    }
}

/** Retry what is queued and erase what has waited too long. Never throws. */
export async function processDeliveries(now: Date = new Date()): Promise<number> {
    let sent = 0;
    try {
        const data = await hasuraAdmin<{ deliveries: Row[] }>(
            `query QueuedDeliveries($limit: Int!) {
                deliveries(where: { status: { _eq: "queued" } }, order_by: { created_at: asc }, limit: $limit) { ${FIELDS} }
            }`,
            { limit: BATCH },
        );
        for (const row of data.deliveries) {
            if ((await attemptDelivery(row, now)) === "sent") sent++;
        }
    } catch (e) {
        console.error("Processing deliveries failed:", (e as Error).name);
    }
    return sent;
}

export function toView(row: Pick<Row, "status" | "sent_at">): DeliveryView {
    return { channel: "digipost", status: row.status, sentAt: row.sent_at };
}

export async function deliveriesLastDay(organizationId: string, now: Date = new Date()): Promise<number> {
    const data = await hasuraAdmin<{ deliveries_aggregate: { aggregate: { count: number } } }>(
        `query DeliveriesLastDay($organizationId: uuid!, $since: timestamptz!) {
            deliveries_aggregate(where: { organization_id: { _eq: $organizationId }, created_at: { _gte: $since } }) {
                aggregate { count }
            }
        }`,
        { organizationId, since: new Date(now.getTime() - 24 * 3600_000).toISOString() },
    );
    return data.deliveries_aggregate.aggregate.count;
}
