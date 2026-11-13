import { hasuraAdmin } from "../lib/hasura";
import type { ErrorReport, ErrorSink } from "../ports";

// Keeps one row per distinct error in our own database. A table full of
// errors is not worth more errors, so there is a ceiling on distinct rows.
const MAX_DISTINCT = 500;
const MAX_DISTINCT_OUTSIDE = 100;

export function hasuraErrorSink(): ErrorSink {
    return {
        async record(report: ErrorReport): Promise<boolean> {
            try {
                const updated = await hasuraAdmin<{
                    update_platform_errors: { affected_rows: number };
                    platform_errors_aggregate: { aggregate: { count: number } };
                }>(
                    `mutation BumpPlatformError($fingerprint: String!, $count: Int!, $requestId: String, $now: timestamptz!) {
                        update_platform_errors(
                            where: { fingerprint: { _eq: $fingerprint } },
                            _inc: { count: $count },
                            _set: { last_seen: $now, request_id: $requestId, resolved_at: null }
                        ) { affected_rows }
                    }`,
                    { fingerprint: report.fingerprint, count: report.count, requestId: report.requestId, now: new Date().toISOString() },
                );
                if (updated.update_platform_errors.affected_rows > 0) return false;

                // Reports from outside get their own, smaller share. Anyone
                // can post them, and they must not crowd out our own errors.
                const outside = report.source === "web" || report.source === "browser";
                const total = await hasuraAdmin<{ platform_errors_aggregate: { aggregate: { count: number } } }>(
                    `query CountPlatformErrors($sources: [String!]!) {
                        platform_errors_aggregate(where: { source: { _in: $sources } }) { aggregate { count } }
                    }`,
                    { sources: outside ? ["web", "browser"] : ["api", "job"] },
                );
                const ceiling = outside ? MAX_DISTINCT_OUTSIDE : MAX_DISTINCT;
                if (total.platform_errors_aggregate.aggregate.count >= ceiling) return false;

                await hasuraAdmin(
                    `mutation InsertPlatformError($object: platform_errors_insert_input!) {
                        insert_platform_errors_one(
                            object: $object,
                            on_conflict: { constraint: platform_errors_fingerprint_key, update_columns: [last_seen] }
                        ) { id }
                    }`,
                    {
                        object: {
                            fingerprint: report.fingerprint,
                            source: report.source,
                            place: report.place,
                            kind: report.kind,
                            message: report.message,
                            stack: report.stack,
                            request_id: report.requestId,
                            count: report.count,
                        },
                    },
                );
                return true;
            } catch {
                return false;
            }
        },
    };
}
