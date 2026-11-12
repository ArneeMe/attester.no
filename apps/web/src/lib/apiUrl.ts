export function apiUrl(path: string, query?: URLSearchParams): string {
    const base = process.env.API_URL;
    if (!base) throw new Error("API_URL not configured");
    const url = new URL(base);
    url.searchParams.set("__path", path);
    query?.forEach((value, key) => {
        if (key !== "__path") url.searchParams.append(key, value);
    });
    return url.toString();
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(apiUrl(path), { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
    return (await res.json()) as T;
}
