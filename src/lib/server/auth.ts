export function isValidJwt(authHeader: string | null): boolean {
    if (!authHeader?.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    try {
        // base64url → base64 → decode (atob works on Node.js and Edge/Workers)
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64));
        return typeof payload.exp === "number" && payload.exp > Date.now() / 1000;
    } catch {
        return false;
    }
}
