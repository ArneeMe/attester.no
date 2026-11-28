import { hasuraAdmin } from "../lib/hasura";

// An error nobody has seen recur for this long is history, not a problem.
export const ERROR_RETENTION_DAYS = 30;

export type StoredError = {
    id: string;
    source: string;
    place: string;
    kind: string;
    message: string;
    stack: string;
    request_id: string | null;
    count: number;
    first_seen: string;
    last_seen: string;
};

export async function listErrors(): Promise<StoredError[]> {
    const data = await hasuraAdmin<{ platform_errors: StoredError[] }>(
        `query ListPlatformErrors {
            platform_errors(where: { resolved_at: { _is_null: true } }, order_by: { last_seen: desc }, limit: 100) {
                id source place kind message stack request_id count first_seen last_seen
            }
        }`,
    );
    return data.platform_errors;
}

// Resolved, not deleted: if it happens again the row comes back with its
// history, and the owner is told it is new.
export async function resolveError(id: string): Promise<boolean> {
    const data = await hasuraAdmin<{ update_platform_errors: { affected_rows: number } }>(
        `mutation ResolvePlatformError($id: uuid!, $now: timestamptz!) {
            update_platform_errors(where: { id: { _eq: $id } }, _set: { resolved_at: $now }) { affected_rows }
        }`,
        { id, now: new Date().toISOString() },
    );
    return data.update_platform_errors.affected_rows > 0;
}

/** Never throws. */
export async function pruneErrors(now: Date = new Date()): Promise<void> {
    try {
        await hasuraAdmin(
            `mutation PrunePlatformErrors($before: timestamptz!) {
                delete_platform_errors(where: { last_seen: { _lt: $before } }) { affected_rows }
            }`,
            { before: new Date(now.getTime() - ERROR_RETENTION_DAYS * 24 * 3600_000).toISOString() },
        );
    } catch {
        // The next round tries again.
    }
}
