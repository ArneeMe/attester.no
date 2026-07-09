// Fixed-window rate limiter held in module memory. On Cloudflare Pages each
// edge isolate gets its own map, so this is best-effort — a distributed
// attacker hitting many colos gets more headroom than the nominal limit.
// That is fine for what it protects: an anonymous flooder filling an org's
// review queue from one machine. Swap for a KV/Durable-Object-backed limiter
// if that assumption stops holding.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Keep the map bounded even under a key-spraying attack.
const MAX_BUCKETS = 10_000;

function pruneExpired(now: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

/**
 * Count a hit against `key`. Returns true if the hit is within `limit`
 * per `windowMs`, false if the caller should be rejected (429).
 */
export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
): boolean {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        if (buckets.size >= MAX_BUCKETS) pruneExpired(now);
        if (buckets.size >= MAX_BUCKETS) buckets.clear();
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
}

/** Test hook: drop all state. */
export function resetRateLimiter() {
    buckets.clear();
}

/**
 * Client IP as seen by Cloudflare. CF-Connecting-IP is set by the edge and
 * not spoofable through it; x-forwarded-for is a dev/localhost fallback.
 */
export function clientIp(headers: Headers): string {
    return (
        headers.get("cf-connecting-ip")
        ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? "unknown"
    );
}
