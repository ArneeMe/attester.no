export async function canonicalHash(searchParams: URLSearchParams): Promise<string> {
    const copy = new URLSearchParams(searchParams);
    copy.delete("t");
    const sorted = [...copy.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const msgBuffer = new TextEncoder().encode(sorted);
    const hashBuffer = await crypto.subtle.digest("SHA-512", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
