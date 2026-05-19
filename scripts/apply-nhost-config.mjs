// Applies nhost/schema.sql and Hasura permissions to your Nhost project.
// Idempotent: safe to re-run.
//
// Usage:
//   1. Get the admin secret from Nhost dashboard → Settings → Hasura → Admin secret.
//   2. Set it in .env.local as NHOST_ADMIN_SECRET (never commit this).
//   3. node --env-file=.env.local scripts/apply-nhost-config.mjs

import { readFile } from "node:fs/promises";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;

if (!subdomain || !region || !adminSecret) {
    console.error("Missing NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, or NHOST_ADMIN_SECRET in env.");
    process.exit(1);
}

const HASURA = `https://${subdomain}.hasura.${region}.nhost.run`;
const headers = {
    "content-type": "application/json",
    "x-hasura-admin-secret": adminSecret,
};

async function hasura(path, body) {
    const res = await fetch(`${HASURA}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${path} ${res.status}: ${text}`);
    }
    return JSON.parse(text);
}

// ---- 1. Apply schema ----
const sql = await readFile("nhost/schema.sql", "utf8");
console.log("Applying schema.sql…");
await hasura("/v2/query", { type: "run_sql", args: { sql, cascade: true } });

// ---- 2. Define desired state ----
const TABLES = ["organizations", "certificates", "user_organizations", "volunteers", "templates"];

const PERMISSIONS = [
    // organizations
    { table: "organizations", role: "public", select: { columns: ["id", "slug", "name", "generic_text", "groups", "signatures", "created_at"], filter: {} } },
    { table: "organizations", role: "user", select: { columns: "*", filter: {} } },
    { table: "organizations", role: "user", update: { columns: ["generic_text", "groups", "signatures", "name"], filter: {}, check: {} } },

    // certificates
    { table: "certificates", role: "public", select: { columns: "*", filter: {} } },
    { table: "certificates", role: "user", insert: { columns: ["organization_id", "volunteer_id", "hash"], check: {} } },

    // volunteers
    { table: "volunteers", role: "public", insert: { columns: ["id", "organization_id", "person_name", "group_name", "start_date", "end_date", "role", "extra_roles"], check: {} } },
    { table: "volunteers", role: "user", select: { columns: "*", filter: {} } },
    { table: "volunteers", role: "user", delete: { filter: {} } },

    // templates
    { table: "templates", role: "user", select: { columns: "*", filter: {} } },
    { table: "templates", role: "user", insert: { columns: ["organization_id", "name", "description", "base_pdf", "schemas", "is_default"], check: {} } },
    { table: "templates", role: "user", update: { columns: ["name", "description", "base_pdf", "schemas", "is_default"], filter: {}, check: {} } },
];

const t = (name) => ({ schema: "public", name });

// ---- 3. Track tables (ignore already-tracked) ----
console.log("Tracking tables…");
await hasura("/v1/metadata", {
    type: "bulk_keep_going",
    args: TABLES.map((name) => ({ type: "pg_track_table", args: { source: "default", table: t(name) } })),
});

// ---- 4. Drop our managed permissions, then recreate ----
console.log("Resetting permissions…");
const dropOps = [];
const createOps = [];

for (const p of PERMISSIONS) {
    const base = { source: "default", table: t(p.table), role: p.role };
    for (const op of ["select", "insert", "update", "delete"]) {
        if (p[op]) {
            dropOps.push({ type: `pg_drop_${op}_permission`, args: base });
            createOps.push({ type: `pg_create_${op}_permission`, args: { ...base, permission: p[op] } });
        }
    }
}

await hasura("/v1/metadata", { type: "bulk_keep_going", args: dropOps });
await hasura("/v1/metadata", { type: "bulk", args: createOps });

// ---- 5. Reload metadata so changes take effect immediately ----
await hasura("/v1/metadata", { type: "reload_metadata", args: {} });

console.log(`Done. ${TABLES.length} tables tracked, ${createOps.length} permissions applied.`);
