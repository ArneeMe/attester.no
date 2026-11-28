// API_URL is the API's /v1 root, e.g. https://api.attester.no/v1.
export function apiUrl(path: string, query?: URLSearchParams): string {
    const base = process.env.API_URL;
    if (!base) throw new Error("API_URL not configured");
    const qs = query?.toString();
    return `${base.replace(/\/+$/, "")}${path}${qs ? `?${qs}` : ""}`;
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(apiUrl(path), { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
    return (await res.json()) as T;
}
