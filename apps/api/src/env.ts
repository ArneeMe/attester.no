function nhostHost(service: string): string {
    const subdomain = process.env.NHOST_SUBDOMAIN ?? process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
    const region = process.env.NHOST_REGION ?? process.env.NEXT_PUBLIC_NHOST_REGION;
    if (!subdomain || !region) throw new Error("NHOST_SUBDOMAIN / NHOST_REGION not configured");
    return `https://${subdomain}.${service}.${region}.nhost.run`;
}

export function graphqlUrl(): string {
    return process.env.HASURA_GRAPHQL_URL ?? `${nhostHost("hasura")}/v1/graphql`;
}

export function jwksUrl(): string {
    return process.env.AUTH_JWKS_URL ?? `${nhostHost("auth")}/v1/.well-known/jwks.json`;
}

export function adminSecret(): string {
    const secret = process.env.NHOST_ADMIN_SECRET;
    if (!secret) throw new Error("NHOST_ADMIN_SECRET not configured");
    return secret;
}
