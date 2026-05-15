export function isValidJwt(authHeader: string | null): boolean {
    if (!authHeader?.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        return typeof payload.exp === "number" && payload.exp > Date.now() / 1000;
    } catch {
        return false;
    }
}
